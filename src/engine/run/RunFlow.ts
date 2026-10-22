// Plain-TS orchestrator for one Flappy-Quiz run: lives, barrier counting,
// question cadence (one every BARRIERS_PER_QUESTION barriers), end-of-run
// summary and persistence of the finished game. No Phaser dependency, so the
// whole rule set is testable headlessly. Question text always comes from the
// content passed to startRun.
import { DecisionScene } from '../scenes/DecisionScene';
import { EndOfPhaseReview } from '../ui/EndOfPhaseReview';
import type { EvolutionView, ReviewItem } from '../ui/EndOfPhaseReview';
import { HowItWorks } from '../ui/HowItWorks';
import { RunHud } from '../ui/RunHud';
import { BARRIERS_PER_QUESTION, COINS_PER_QUESTION, LIVES_PER_RUN } from '../config';
import { pickCameo } from '../cast';
import { applyAnswers, goalText, runProgress } from '../progress';
import { DEFAULT_STYLE } from '../styles';
import type { GameStyle } from '../styles';
import { TIMEOUT_CHOICE_ID } from '../systems/ScoringSystem';
import { timeLimitSeconds } from '../timeLimit';
import { levelTuning } from './levelTuning';
import type { LevelTuning } from './levelTuning';
import type { QuestionContent } from '../content/types';
import { pickQuestions } from '../modes';
import { shuffle } from '../random';
import type { GameStore } from '../../state/GameStore';
import type { QuestionReportInput } from '../../state/reports';
import type { AnswerRecord, GameRecord, ProgressSnapshot, RunResult } from '../../state/records';

export interface RunFlowOptions {
  uiRoot: HTMLElement;
  store: GameStore;
  random?: () => number;
  now?: () => Date;
  newId?: () => string;
  confirmAbandon?: () => boolean;
  /** Ranking line shown on the end screen once the game is saved ('' = none). */
  getRankLine?: () => Promise<string>;
  /** Told how many questions a run answered (once per run, any ending); returns the study-habit line for the end screen. */
  onRunEnd?: (answered: number) => string;
}

export interface RunSetup {
  roomId?: string; // the room being played (saved with the game; missing = Compliance)
  modeId: string;
  style?: GameStyle; // how the questions are reached (default: obstaculos)
  modeTitle: string;
  pool: readonly QuestionContent[];
  count: number;
  /** The whole question bank and the player's standing before this run: they
   *  let the end screen show how much the run moved the player forward. */
  bank?: readonly QuestionContent[];
  before?: ProgressSnapshot;
}

export interface LastChanceResult {
  correct: boolean;
  gameOver: boolean;
}

export type Collision = 'life-lost' | 'last-chance';

export interface QuestionResult {
  correct: boolean;
  heart?: boolean; // Contra o tempo: the one-time bonus life was just given
  streak: number;
  gameOver: boolean;
  completed: boolean;
}

export type RunEnd = 'again' | 'menu' | 'continue';
export type FinishKind = 'complete' | 'gameover' | 'abandoned';

const defaultNewId = (): string => crypto.randomUUID();

export class RunFlow {
  private readonly uiRoot: HTMLElement;
  private readonly store: GameStore;
  private readonly random: () => number;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly confirmAbandon: () => boolean;
  private readonly hud: RunHud;
  private readonly getRankLine: (() => Promise<string>) | null;
  private readonly onRunEnd: ((answered: number) => string) | null;

  /** Set by the app: called when the player confirmed leaving the run from the HUD. */
  onAbandon: (() => void) | null = null;

  private setup: RunSetup | null = null;
  private lives = LIVES_PER_RUN;
  private barriersPassed = 0;
  private questions: QuestionContent[] = [];
  private answers: AnswerRecord[] = [];
  private reviewItems: ReviewItem[] = [];
  private xp = 0;
  private streak = 0;
  private asked = 0; // scheduled questions answered (last-chance ones do not count)
  private heartSpawned = false;
  // "Continuar jogando": what earlier segments of the same run already answered,
  // so the barriers keep their speed. Lives and streak simply carry over.
  private carryAsked = 0;
  private carryCorrect = 0;
  private segment = 0;
  private skipIntro = false;
  private style: GameStyle = DEFAULT_STYLE;
  private startedAt = new Date();
  private busy = false;

  constructor(opts: RunFlowOptions) {
    this.uiRoot = opts.uiRoot;
    this.store = opts.store;
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? defaultNewId;
    this.confirmAbandon =
      opts.confirmAbandon ?? (() => window.confirm('Sair desta partida? O que você já respondeu fica salvo.'));
    this.getRankLine = opts.getRankLine ?? null;
    this.onRunEnd = opts.onRunEnd ?? null;
    this.hud = new RunHud(this.uiRoot, () => this.requestAbandon());
    this.hud.setVisible(false);
  }

  /** Starts a fresh run over `count` random questions of the pool. */
  startRun(setup: RunSetup): LevelTuning {
    this.setup = setup;
    this.style = setup.style ?? DEFAULT_STYLE;
    this.hud.setStyle(this.style);
    this.questions = pickQuestions(setup.pool, setup.count, this.random, setup.before?.statuses);
    this.lives = LIVES_PER_RUN;
    this.barriersPassed = 0;
    this.answers = [];
    this.reviewItems = [];
    this.xp = 0;
    this.streak = 0;
    this.asked = 0;
    this.heartSpawned = false;
    this.carryAsked = 0;
    this.carryCorrect = 0;
    this.segment = 0;
    this.skipIntro = false;
    this.busy = false;
    this.startedAt = this.now();
    this.hud.setVisible(true);
    this.updateHud();
    return this.getTuning();
  }

  /**
   * After a completed run: keeps playing with the same lives and speed over a
   * fresh set of questions (the ones not answered in the finished segment come
   * first). The finished segment was already saved; the next one saves its own game.
   */
  continueRun(): LevelTuning {
    const setup = this.setup;
    if (!setup) throw new Error('RunFlow: no run in progress');
    this.carryAsked += this.asked;
    this.carryCorrect += this.answers.filter((a) => a.correct).length;
    if (setup.before) {
      setup.before = { statuses: applyAnswers(setup.before.statuses, this.answers), totalXp: setup.before.totalXp + this.xp };
    }
    const count = Math.min(setup.pool.length, Math.max(5, setup.count));
    const seen = new Set(this.answers.map((a) => a.questionId));
    const statuses = setup.before?.statuses;
    const fresh = pickQuestions(setup.pool.filter((q) => !seen.has(q.sceneId)), count, this.random, statuses);
    const again = pickQuestions(setup.pool.filter((q) => seen.has(q.sceneId)), count - fresh.length, this.random, statuses);
    this.questions = [...fresh, ...again];
    this.segment += 1;
    this.answers = [];
    this.reviewItems = [];
    this.xp = 0;
    this.asked = 0;
    this.barriersPassed = 0;
    this.heartSpawned = false;
    this.skipIntro = true;
    this.busy = false;
    this.startedAt = this.now();
    this.hud.setVisible(true);
    this.updateHud();
    return this.getTuning();
  }

  getTuning(): LevelTuning {
    return levelTuning(this.carryAsked + this.asked, this.carryCorrect + this.answers.filter((a) => a.correct).length);
  }

  getStyle(): GameStyle {
    return this.style;
  }

  getModeTitle(): string {
    return this.setup?.modeTitle ?? '';
  }

  getLives(): number {
    return this.lives;
  }

  getBarriersPassed(): number {
    return this.barriersPassed;
  }

  getQuestionsAnswered(): number {
    return this.asked;
  }

  getQuestionTotal(): number {
    return this.questions.length;
  }

  getXp(): number {
    return this.xp;
  }

  isBusy(): boolean {
    return this.busy;
  }

  hideHud(): void {
    this.hud.setVisible(false);
  }

  /** Barriers (or coins, in Fuja dos ladrões) between two questions. */
  private everyN(): number {
    return this.style === 'pacman' ? COINS_PER_QUESTION : BARRIERS_PER_QUESTION;
  }

  /** Counts one cleared barrier (or one coin). Returns true when a question is due now. */
  barrierPassed(): boolean {
    this.barriersPassed += 1;
    this.updateHud();
    return this.barriersPassed % this.everyN() === 0 && this.asked < this.questions.length;
  }

  /**
   * A collision costs a life, except on the LAST one: then nothing is lost yet and
   * the scene asks a last-chance question (askLastChance) that decides the run.
   */
  collide(): Collision {
    if (this.lives > 1) {
      this.lives -= 1;
      this.updateHud();
      return 'life-lost';
    }
    return 'last-chance';
  }

  /** The heart: one per run, in the middle of it, and only if a life was lost. */
  wantsHeart(): boolean {
    return (
      !this.heartSpawned &&
      this.lives < LIVES_PER_RUN &&
      this.asked >= Math.ceil(this.questions.length / 2) &&
      this.asked < this.questions.length
    );
  }

  markHeartSpawned(): void {
    this.heartSpawned = true;
  }

  /** Picks up the heart. False when lives are already full. */
  gainLife(): boolean {
    if (this.lives >= LIVES_PER_RUN) return false;
    this.lives += 1;
    this.updateHud();
    return true;
  }

  /** Brief, skippable explanation of the rules, shown before the run starts. */
  showIntro(): Promise<void> {
    if (this.skipIntro) return Promise.resolve();
    return new HowItWorks(this.uiRoot).show({ lives: LIVES_PER_RUN, barriers: this.everyN(), style: this.style });
  }

  // A question that is not part of the run's list: unused ones first.
  private pickLastChanceQuestion(): QuestionContent {
    const pool = this.setup?.pool ?? [];
    const planned = new Set(this.questions.map((q) => q.sceneId));
    const answered = new Set(this.answers.map((a) => a.questionId));
    const candidates = [
      pool.filter((q) => !planned.has(q.sceneId)),
      pool.filter((q) => !answered.has(q.sceneId)),
      pool,
    ].find((list) => list.length > 0);
    if (!candidates) throw new Error('RunFlow: no question available');
    return candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))];
  }

  /** Last chance on the last life: right = keeps playing with that life, wrong = run over. */
  async askLastChance(): Promise<LastChanceResult> {
    if (this.busy) throw new Error('RunFlow: a question is already open');
    const base = this.pickLastChanceQuestion();
    this.busy = true;
    this.hud.setMenuEnabled(false);
    try {
      const question: QuestionContent = { ...base, choices: shuffle(base.choices, this.random) };
      const outcome = await new DecisionScene({ root: this.uiRoot, onReport: this.reportHandler() }).run(question, {
        index: this.asked + 1,
        total: this.questions.length,
        streak: this.streak,
        lastChance: true,
      });
      this.record(base, outcome.chosenChoiceId, outcome.correct, outcome.xpEarned);
      if (!outcome.correct) this.lives = 0;
      this.updateHud();
      return { correct: outcome.correct, gameOver: !outcome.correct };
    } finally {
      this.busy = false;
      this.hud.setMenuEnabled(true);
    }
  }

  // "Reportar" on the question screen: the store gets the report with this run's room.
  private reportHandler(): (input: QuestionReportInput) => Promise<'saved' | 'queued'> {
    return (input) =>
      this.store.reportQuestion({
        ...input,
        id: this.newId(),
        ...(this.setup?.roomId ? { roomId: this.setup.roomId } : {}),
        createdAt: this.now().toISOString(),
      });
  }

  private record(base: QuestionContent, chosenChoiceId: string, correct: boolean, xpEarned: number): void {
    this.answers.push({
      questionId: base.sceneId,
      chosenChoiceId,
      correct,
      answeredAt: this.now().toISOString(),
    });
    this.xp += xpEarned;
    this.streak = correct ? this.streak + 1 : 0;
    if (!correct) this.reviewItems.push(this.buildReviewItem(base, chosenChoiceId));
  }

  async askQuestion(): Promise<QuestionResult> {
    if (this.busy) {
      throw new Error('RunFlow: a question is already open');
    }
    const base = this.questions[this.asked];
    if (!base) {
      throw new Error('RunFlow: no question left to ask');
    }

    this.busy = true;
    this.hud.setMenuEnabled(false);
    try {
      const question: QuestionContent = { ...base, choices: shuffle(base.choices, this.random) };
      const outcome = await new DecisionScene({ root: this.uiRoot, onReport: this.reportHandler() }).run(question, {
        index: this.asked + 1,
        total: this.questions.length,
        streak: this.streak,
        timeLimitMs: this.style === 'tempo' ? timeLimitSeconds(base) * 1000 : undefined,
      });

      this.asked += 1;
      this.record(base, outcome.chosenChoiceId, outcome.correct, outcome.xpEarned);
      if (!outcome.correct) this.lives = Math.max(0, this.lives - 1);
      // Contra o tempo has no hearts to catch: the bonus life comes with a right answer.
      let heart = false;
      if (this.style === 'tempo' && outcome.correct && this.wantsHeart()) {
        this.heartSpawned = true;
        this.lives += 1;
        heart = true;
      }
      this.updateHud();

      return {
        correct: outcome.correct,
        heart,
        streak: this.streak,
        gameOver: this.lives === 0,
        completed: this.lives > 0 && this.asked >= this.questions.length,
      };
    } finally {
      this.busy = false;
      this.hud.setMenuEnabled(true);
    }
  }

  private buildReviewItem(question: QuestionContent, chosenChoiceId: string): ReviewItem {
    const chosen = question.choices.find((c) => c.id === chosenChoiceId);
    const correct = question.choices.find((c) => c.correct);
    return {
      summary: question.question,
      chosenText: chosen?.text ?? (chosenChoiceId === TIMEOUT_CHOICE_ID ? 'Tempo esgotado' : ''),
      correctText: correct?.text ?? '',
      explanation: correct?.feedback ?? '',
    };
  }

  private requestAbandon(): void {
    if (this.busy) return;
    if (this.confirmAbandon()) this.onAbandon?.();
  }

  private buildRecord(kind: FinishKind): GameRecord {
    const setup = this.setup;
    if (!setup) throw new Error('RunFlow: no run in progress');
    const result: RunResult = kind === 'complete' ? 'completed' : kind;
    return {
      id: this.newId(),
      ...(setup.roomId ? { roomId: setup.roomId } : {}),
      modeId: setup.modeId,
      style: this.style,
      requestedCount: this.questions.length,
      answeredCount: this.answers.length,
      correctCount: this.answers.filter((a) => a.correct).length,
      xp: this.xp,
      result,
      startedAt: this.startedAt.toISOString(),
      endedAt: this.now().toISOString(),
      answers: [...this.answers],
    };
  }

  /**
   * Ends the run: saves the game (never blocks or throws into the game) and,
   * unless the player abandoned, shows the summary + review. Resolves with the
   * player's next step.
   */
  async finishRun(kind: FinishKind): Promise<RunEnd> {
    const record = this.buildRecord(kind);
    this.hud.setVisible(false);
    let focusLine = '';
    try {
      focusLine = this.onRunEnd?.(record.answeredCount) ?? '';
    } catch {
      // the habit card is a bonus: it never blocks the end of a run
    }

    const saving = this.persist(record, kind !== 'abandoned');
    if (kind === 'abandoned') {
      await saving;
      return 'menu';
    }

    const review = new EndOfPhaseReview(this.uiRoot);
    const evolution = this.buildEvolution(record);
    const perfect = kind === 'complete' && record.answeredCount >= 5 && record.correctCount === record.answeredCount;
    const cameo = pickCameo(perfect ? 'perfect' : kind === 'complete' ? 'complete' : 'gameover', {}, this.random);
    const shown = review.show({
      headerLine: kind === 'complete' ? 'Missão cumprida' : 'Fim de jogo',
      xp: record.xp,
      statsLine: `${record.correctCount} de ${record.answeredCount} acertos · ${this.asked}/${record.requestedCount} questões`,
      evolution,
      cameo: { name: cameo.who.name, role: cameo.who.role, frame: cameo.who.frame, mug: cameo.who.mug, line: cameo.line },
      title: 'O que escapou',
      items: this.reviewItems,
      emptyBody:
        kind === 'complete'
          ? 'Você acertou todas as questões desta rodada.'
          : 'Você não errou nenhuma pergunta antes de perder as vidas — o desafio foi desviar das barreiras.',
      actions: [
        ...(kind === 'complete' ? [{ id: 'continue', label: 'Continuar jogando', primary: true }] : []),
        { id: 'again', label: kind === 'complete' ? 'Mais uma rodada' : 'Revanche', primary: kind !== 'complete' },
        { id: 'menu', label: 'Voltar à sala' },
      ],
    });
    review.setFocus(focusLine);
    review.setStatus('Salvando…');
    void saving.then((status) => {
      review.setStatus(status);
      if (!this.getRankLine) return;
      void this.getRankLine().then((line) => review.setRank(line)).catch(() => undefined);
    });

    const choice = await shown;
    review.unmount();
    return choice === 'again' || choice === 'continue' ? choice : 'menu';
  }

  private buildEvolution(record: GameRecord): EvolutionView | undefined {
    const { bank, before } = this.setup ?? {};
    if (!bank || !before) return undefined;
    const progress = runProgress({
      bank,
      statusesBefore: before.statuses,
      answers: record.answers,
      xpBefore: before.totalXp,
      xpGained: record.xp,
    });
    return {
      pctBefore: progress.before.pct,
      pctAfter: progress.after.pct,
      stageName: progress.after.stage.name,
      stageUp: progress.stageUp,
      masteredDelta: progress.masteredDelta,
      mastered: progress.after.mastered,
      total: progress.total,
      level: progress.after.level,
      levelUp: progress.levelUp,
      xpIntoLevel: progress.xpIntoLevel,
      xpForNext: progress.xpForNext,
      goal: goalText(progress.toNextStage),
    };
  }

  private async persist(record: GameRecord, report: boolean): Promise<string> {
    if (record.answeredCount === 0 && record.result === 'abandoned') {
      return '';
    }
    try {
      const status = await this.store.saveGame(record);
      if (!report) return '';
      return status === 'saved'
        ? 'Partida salva.'
        : 'Sem conexão: partida guardada neste aparelho e será enviada depois.';
    } catch {
      return report ? 'Não foi possível salvar esta partida.' : '';
    }
  }

  private updateHud(): void {
    this.hud.update({
      lives: this.lives,
      maxLives: LIVES_PER_RUN,
      modeTitle: this.segment > 0 ? `${this.setup?.modeTitle ?? ''} · bônus ${this.segment}` : (this.setup?.modeTitle ?? ''),
      barriersToQuestion: this.everyN() - (this.barriersPassed % this.everyN()),
      questionsAnswered: this.asked,
      questionTotal: this.questions.length,
      xpTotal: this.xp,
      streak: this.streak,
      speedPct: this.getTuning().speedPct,
    });
  }
}
