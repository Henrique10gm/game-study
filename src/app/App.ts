// Ties the pieces together. The game is a hall of rooms: the walk in front of the
// bank (MenuScene) -> the hall with one door per room (HubScene) -> inside a room
// (MenuScene again: missions, ranking and profile of THAT room) -> pick a mission
// -> pick a mode -> pick a size -> cutscene -> run (FlappyScene) -> back to the room.
// Every run is the same game loop; the only thing that changes is the room (its
// missions and its pool of questions) plugged in when the run starts.
import type Phaser from 'phaser';
import type { ContentSource, QuestionContent, RoomDef } from '../engine/content/types';
import { getMode, questionsForMode, sizeOptions } from '../engine/modes';
import { pickCameo } from '../engine/cast';
import { DAILY_GOAL, focusView, loadFocus, recordAnswers, saveFocus } from '../engine/focus';
import type { FocusState } from '../engine/focus';
import { goalFor, levelFor, masteryOf, stageFor, wrongIdsOf } from '../engine/progress';
import { RunFlow } from '../engine/run/RunFlow';
import { ALL_SCENE_KEYS, DEFAULT_STYLE, getStyle } from '../engine/styles';
import type { GameStyle } from '../engine/styles';
import type { RunEnd } from '../engine/run/RunFlow';
import type { HallView, HomeData, ReadinessView, SizeData } from '../engine/ui/BankMenu';
import type { HubRoomView } from '../engine/scenes/HubScene';
import type { MenuScene } from '../engine/scenes/MenuScene';
import { MenuUi } from '../engine/ui/MenuUi';
import type { ProfileProgress } from '../engine/ui/MenuUi';
import { GroupsScreen } from '../engine/ui/GroupsScreen';
import { RankingScreen } from '../engine/ui/RankingScreen';
import { hideLoader, showLoader } from '../engine/ui/bootLoader';
import { UpdateNotice } from '../engine/ui/UpdateNotice';
import { markUpdateSeen, pendingUpdate } from '../engine/updates';
import { startScreenTimer } from '../engine/screenTime';
import { THEME_EVENT } from '../engine/theme';
import { appCorner } from '../engine/ui/corner';
import { readFocusRoom } from '../state/certFocus';
import type { GameStore } from '../state/GameStore';
import type { GroupsApi } from '../state/GroupService';
import { LocalGameStore } from '../state/LocalGameStore';
import { computeStats } from '../state/records';
import type { NicknameProblem, ProgressSnapshot } from '../state/records';

/** One room of the hall: its definition and the questions it plays with. */
export interface RoomEntry {
  def: RoomDef;
  content: ContentSource;
}

export interface AppOptions {
  game: Phaser.Game;
  uiRoot: HTMLElement;
  store: GameStore;
  rooms: RoomEntry[];
  /** Where the "already saw this update" mark lives (null = always show the notice). */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Groups of the signed-in player (cloud only): the ranking is per group. */
  groups?: GroupsApi;
  /** One-off message for the first screen (e.g. the result of an invite link). */
  initialNotice?: string;
  /** First screen: in front of the bank (default) or the hall (the visitor just walked in from the landing page). */
  startAt?: 'entrance' | 'hall';
}

interface LastRun {
  modeId: string;
  style: GameStyle;
  complete: boolean;
  count: number;
}

const EMPTY_PROGRESS: ProgressSnapshot = { statuses: {}, totalXp: 0 };

const NICKNAME_MESSAGES: Record<NicknameProblem, string> = {
  invalid: 'Use 2 a 20 caracteres: letras, números, espaço, ponto, traço ou sublinhado, começando por letra ou número.',
  taken: 'Esse apelido já está em uso. Escolha outro.',
  unavailable: 'O ranking não está disponível neste modo.',
  failed: 'Não foi possível salvar agora. Tente de novo.',
};

export class App {
  private readonly game: Phaser.Game;
  private readonly uiRoot: HTMLElement;
  private readonly rooms: RoomEntry[];
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private readonly menu: MenuUi;
  private readonly ranking: RankingScreen;
  private readonly groupsScreen: GroupsScreen;
  private readonly groups: GroupsApi | null;
  private readonly startAt: 'entrance' | 'hall';
  private newsChip: HTMLButtonElement | null = null;
  private readonly updateNotice: UpdateNotice;
  private store: GameStore;
  private flow: RunFlow | null = null;
  private room: RoomEntry | null = null;
  private notice: string | undefined;
  private last: LastRun | null = null;
  private progress: ProgressSnapshot = EMPTY_PROGRESS;
  private focus: FocusState = loadFocus();

  constructor(opts: AppOptions) {
    this.game = opts.game;
    this.uiRoot = opts.uiRoot;
    this.store = opts.store;
    this.rooms = opts.rooms;
    this.storage = opts.storage ?? null;
    this.menu = new MenuUi(this.uiRoot);
    this.ranking = new RankingScreen(this.uiRoot);
    this.groupsScreen = new GroupsScreen(this.uiRoot);
    this.groups = opts.groups ?? null;
    this.startAt = opts.startAt ?? 'entrance';
    window.addEventListener(THEME_EVENT, () => this.redrawForTheme());
    this.notice = opts.initialNotice;
    this.updateNotice = new UpdateNotice(this.uiRoot);
  }

  /** Waits for the assets and the store, then opens the walk in front of the bank. */
  async start(): Promise<void> {
    const assetsReady = new Promise<void>((resolve) => this.game.events.once('assets-ready', resolve));
    await Promise.all([assetsReady, this.initStore()]);

    this.flow = new RunFlow({
      uiRoot: this.uiRoot,
      store: this.store,
      getRankLine: () => this.rankLine(),
      onRunEnd: (answered) => this.recordFocus(answered),
    });
    this.flow.onAbandon = () => void this.abandonRun();
    this.game.registry.set('runFlow', this.flow);
    this.game.events.on('run-finished', (next: RunEnd) => void this.afterRun(next));

    startScreenTimer((report) => this.store.recordScreenTime(report), () => this.room?.def.id ?? null);
    if (this.startAt === 'hall') this.showHub(undefined, true);
    else this.showEntrance();
    hideLoader();
  }

  // The street, the hall and the bank inside are drawn with the theme's colors: when it
  // changes, draw the one on screen again. A run in progress keeps its look until the next one.
  private redrawForTheme(): void {
    for (const key of ['MenuScene', 'HubScene']) {
      if (this.game.scene.isActive(key)) this.game.scene.getScene(key).scene.restart();
    }
  }

  // What is new never covers the first screen: it waits as a small "Novidades" button in the
  // corner (kept until the player opens it, which marks the update as seen).
  private announceUpdate(): void {
    if (this.newsChip) return;
    const update = pendingUpdate(this.storage);
    if (!update) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'app-corner-btn app-corner-btn--news';
    chip.dataset.testid = 'news-chip';
    chip.textContent = '✦ Novidades';
    chip.addEventListener('click', () => {
      markUpdateSeen(this.storage, update);
      chip.remove();
      this.newsChip = null;
      void this.updateNotice.show(update);
    });
    appCorner(this.uiRoot).prepend(chip);
    this.newsChip = chip;
  }

  // If the cloud is unreachable the game still works, saving on this device.
  private async initStore(): Promise<void> {
    try {
      await this.store.init();
    } catch {
      this.store = new LocalGameStore();
      this.notice = 'Sem conexão com o servidor: o progresso será salvo só neste navegador.';
    }
  }

  private get current(): RoomEntry {
    if (!this.room) throw new Error('App: no room is open');
    return this.room;
  }

  private allQuestions(): QuestionContent[] {
    return this.current.content.listQuestions();
  }

  private async loadProgress(): Promise<void> {
    try {
      this.progress = await this.store.getProgress(this.current.def.id);
    } catch {
      this.progress = EMPTY_PROGRESS;
    }
  }

  private stopSceneBeforeNext(): void {
    this.menu.hide();
    this.ranking.hide();
    this.groupsScreen.hide();
    this.stopRunScenes();
    this.game.scene.stop('MenuScene');
    this.game.scene.stop('HubScene');
  }

  // ---- outside the bank and the hall ---------------------------------------

  // The walk in front of the bank: only when the game opens. The door leads to the hall.
  private showEntrance(): void {
    this.room = null;
    this.stopSceneBeforeNext();
    const idle = (): void => undefined;
    this.game.scene.start('MenuScene', {
      intro: true,
      onEnterBank: () => this.showHub(),
      loadSizes: async () => null,
      onStart: idle,
      onRanking: idle,
      onProfile: idle,
      onBack: idle,
    });
  }

  // The hall: one door per room, plus the rooms under construction.
  private showHub(from?: string, arriving = false): void {
    this.room = null;
    this.stopSceneBeforeNext();
    this.announceUpdate();
    const rooms: HubRoomView[] = this.rooms.map(({ def, content }) => {
      const count = content.listQuestions().length;
      return {
        id: def.id,
        title: def.title,
        tagline: def.tagline,
        accent: def.accent,
        status: count > 0 ? `${count} questões` : 'Missões em breve',
      };
    });
    const focusRoomId = readFocusRoom(this.storage) ?? undefined;
    this.game.scene.start('HubScene', {
      rooms,
      from,
      arrive: arriving ? 'door' : undefined,
      focusRoomId,
      onEnterRoom: (id: string) => void this.showRoom(id),
    });
  }

  private async showRoom(roomId: string): Promise<void> {
    const room = this.rooms.find((entry) => entry.def.id === roomId);
    if (!room) return;
    this.room = room;
    this.last = null;
    await this.showHome();
  }

  // ---- inside a room -----------------------------------------------------------

  // The Hall da Fama preview for the menu. It loads after the menu is open (Apps Script can be slow).
  private async loadHall(progressReady: Promise<void>, roomId: string): Promise<HallView> {
    const none: HallView = { available: this.store.kind === 'cloud', entries: [], me: { nickname: null, rank: null }, total: 0, status: 'error' };
    try {
      const board = await this.store.getLeaderboard(roomId);
      await progressReady; // your own row needs your mastered count
      const entries = board.entries.map((e) => ({ rank: e.rank, nickname: e.nickname, mastered: e.mastered, me: e.me }));
      // Not listed (no nickname yet, or beyond the list): still show where you stand, in your place.
      const place = board.me.rank;
      if (board.available && place !== null && !entries.some((e) => e.me)) {
        const mastered = Object.values(this.progress.statuses).filter(Boolean).length;
        const row = { rank: place, nickname: board.me.nickname ?? '', mastered, me: true, ghost: board.me.nickname === null };
        const at = entries.findIndex((e) => e.rank >= place);
        const after = at === -1 ? [] : entries.splice(at).map((e) => ({ ...e, rank: e.rank + 1 }));
        entries.push(row, ...after);
      }
      return {
        available: board.available,
        entries,
        me: { nickname: board.me.nickname, rank: board.me.rank },
        total: board.me.total ?? board.entries.length,
      };
    } catch {
      return none;
    }
  }

  private async showHome(): Promise<void> {
    const room = this.current;
    showLoader(); // the server can take a few seconds to answer
    const progressReady = this.loadProgress();
    await progressReady;
    const cloud = this.store.kind === 'cloud';
    const hall: HallView = { available: cloud, entries: [], me: { nickname: null, rank: null }, total: 0, status: cloud ? 'loading' : undefined };
    const home = { ...this.buildHome(), hall };
    this.stopSceneBeforeNext();
    this.game.scene.start('MenuScene', {
      intro: false,
      home,
      cameo: pickCameo('menu', {
        stage: stageFor(masteryOf(this.allQuestions(), this.progress.statuses).pct).index,
        friday: new Date().getDay() === 5,
      }),
      loadSizes: (modeId: string) => this.loadSizes(modeId),
      onStart: (modeId: string, option: { complete: boolean; count: number }, style: GameStyle = DEFAULT_STYLE) =>
        void this.beginRun({ modeId, style, complete: option.complete, count: option.count }),
      onRanking: () => void this.showRanking(),
      onProfile: () => void this.showProfile(),
      onBack: () => this.showHub(room.def.id),
    });
    hideLoader();
    if (cloud) {
      void this.loadHall(progressReady, room.def.id).then((loaded) => {
        const scene = this.game.scene.getScene('MenuScene') as MenuScene | undefined;
        if (this.room === room && scene && this.game.scene.isActive('MenuScene')) scene.updateHall(loaded);
      });
    }
  }

  // Study habit: every run adds its answers to today's goal; returns the line for the end screen.
  private recordFocus(answered: number): string {
    const now = new Date();
    this.focus = recordAnswers(this.focus, answered, now);
    saveFocus(this.focus);
    const view = focusView(this.focus, now);
    return `Hoje: ${view.today} de ${view.goal} questões. ${view.line}`;
  }

  private wrongIds(): string[] {
    return wrongIdsOf(this.progress.statuses);
  }

  private buildHome(): HomeData {
    const { def } = this.current;
    const all = this.allQuestions();
    const wrongIds = this.wrongIds();
    const emptyRoom = all.length === 0;
    return {
      room: { title: def.title, kicker: def.kicker, menuTitle: def.menuTitle },
      storageKind: this.store.kind,
      notice: [this.notice, emptyRoom ? def.emptyNote : undefined].filter(Boolean).join(' ') || undefined,
      readiness: this.readiness(all),
      focus: focusView(this.focus, new Date(), DAILY_GOAL, wrongIds.length),
      modes: def.modes.map((mode) => {
        const pool = questionsForMode(mode, all, wrongIds);
        const count = pool.length;
        return {
          id: mode.id,
          title: mode.title,
          description: mode.description,
          count,
          // "questions I got wrong" is a to-do list, not a topic with mastery
          mastered: mode.kind === 'wrong' ? undefined : masteryOf(pool, this.progress.statuses).mastered,
          disabledReason:
            count === 0
              ? mode.kind === 'wrong' && !emptyRoom
                ? 'Nenhuma questão errada ainda'
                : emptyRoom
                  ? 'Em breve'
                  : 'Sem questões neste modo'
              : undefined,
        };
      }),
    };
  }

  private readiness(all: readonly QuestionContent[]): ReadinessView | undefined {
    if (all.length === 0) return undefined;
    const mastery = masteryOf(all, this.progress.statuses);
    const exam = masteryOf(
      all.filter((q) => q.exam === true),
      this.progress.statuses,
    );
    const stage = stageFor(mastery.pct);
    const level = levelFor(this.progress.totalXp);
    return {
      pct: mastery.pct,
      stageName: stage.name,
      ready: stage.index === 4,
      mastered: mastery.mastered,
      total: mastery.total,
      examLabel: this.current.def.examLabel,
      examMastered: exam.mastered,
      examTotal: exam.total,
      level: level.level,
      xpIntoLevel: level.xpIntoLevel,
      xpForNext: level.xpForNext,
    };
  }

  private async loadSizes(modeId: string): Promise<SizeData | null> {
    const mode = getMode(this.current.def.modes, modeId);
    if (!mode) return null;
    const pool = questionsForMode(mode, this.allQuestions(), this.wrongIds());
    if (pool.length === 0) return null;
    return { modeTitle: mode.title, options: sizeOptions(pool.length) };
  }

  private async beginRun(run: LastRun): Promise<void> {
    const room = this.current;
    const mode = getMode(room.def.modes, run.modeId);
    if (!mode || !this.flow) return;
    await this.loadProgress();
    const all = this.allQuestions();
    const pool = questionsForMode(mode, all, this.wrongIds());
    if (pool.length === 0) {
      await this.showHome();
      return;
    }
    this.last = run;
    this.menu.hide();
    this.game.scene.stop('MenuScene');
    this.flow.startRun({
      roomId: room.def.id,
      modeId: run.modeId,
      style: run.style,
      modeTitle: mode.title,
      pool,
      count: run.complete ? pool.length : run.count,
      bank: all,
      before: this.progress,
    });
    this.stopRunScenes();
    this.game.scene.start(getStyle(run.style).sceneKey);
  }

  private stopRunScenes(): void {
    for (const key of ALL_SCENE_KEYS) this.game.scene.stop(key);
  }

  private async afterRun(next: RunEnd): Promise<void> {
    this.stopRunScenes();
    if (next === 'continue' && this.last && this.flow) {
      this.flow.continueRun();
      this.game.scene.start(getStyle(this.last.style).sceneKey);
      return;
    }
    if (next === 'again' && this.last) {
      await this.beginRun(this.last);
      return;
    }
    await this.showHome();
  }

  private async abandonRun(): Promise<void> {
    if (!this.flow) return;
    this.stopRunScenes();
    await this.flow.finishRun('abandoned');
    await this.showHome();
  }

  // One line for the end-of-run screen: the position in the room's Hall da Fama, every time.
  private async rankLine(): Promise<string> {
    const board = await this.store.getLeaderboard(this.current.def.id);
    if (!board.available) {
      return this.groups
        ? 'Hall da Fama: escolha um grupo na tela de ranking para competir.'
        : 'Hall da Fama: disponível com uma conta e um grupo.';
    }
    const { rank, total, nickname } = board.me;
    if (rank === null) return '';
    const of = total ? ` de ${total}` : '';
    return nickname
      ? `Hall da Fama: você está em ${rank}º${of}.`
      : `Hall da Fama: você ficaria em ${rank}º${of}. Escolha um apelido para aparecer na lista.`;
  }

  private async showRanking(): Promise<void> {
    const room = this.current;
    let loadError: string | undefined;
    let board = { available: false, entries: [], me: { nickname: null, rank: null } } as Awaited<
      ReturnType<GameStore['getLeaderboard']>
    >;
    showLoader();
    try {
      board = await this.store.getLeaderboard(room.def.id);
    } catch {
      loadError = 'Não foi possível carregar o ranking agora.';
      board = { ...board, available: this.store.kind === 'cloud' };
    }
    const groupName = await this.activeGroupName();
    hideLoader();

    this.game.scene.stop('MenuScene');
    this.menu.hide();
    this.groupsScreen.hide();
    this.ranking.show(
      { roomTitle: room.def.title, board, totalQuestions: this.allQuestions().length, loadError, groupName },
      {
        onBack: () => void this.showHome(),
        onGroups: this.groups ? () => void this.showGroups() : undefined,
        onSaveNickname: async (nickname) => {
          try {
            await this.store.setNickname(nickname);
          } catch (error) {
            const problem = (error instanceof Error ? error.message : 'failed') as NicknameProblem;
            return NICKNAME_MESSAGES[problem] ?? NICKNAME_MESSAGES.failed;
          }
          await this.showRanking();
          return null;
        },
      },
    );
  }

  private async activeGroupName(): Promise<string | undefined> {
    if (!this.groups) return undefined;
    try {
      return (await this.groups.list()).find((group) => group.active)?.name;
    } catch {
      return undefined;
    }
  }

  private async showGroups(): Promise<void> {
    if (!this.groups) return;
    this.ranking.hide();
    await this.groupsScreen.show(this.groups, { onBack: () => void this.showRanking() });
  }

  private profileProgress(): ProfileProgress | undefined {
    const all = this.allQuestions();
    if (all.length === 0) return undefined;
    const readiness = this.readiness(all);
    if (!readiness) return undefined;
    const { modes } = this.current.def;
    const topics = [...modes.filter((mode) => mode.kind === 'category'), ...modes.filter((mode) => mode.kind === 'exam')].map(
      (mode) => {
        const pool = questionsForMode(mode, all);
        return { title: mode.title, ...masteryOf(pool, this.progress.statuses) };
      },
    );
    return {
      pct: readiness.pct,
      stageName: readiness.stageName,
      mastered: readiness.mastered,
      total: readiness.total,
      level: readiness.level,
      xpIntoLevel: readiness.xpIntoLevel,
      xpForNext: readiness.xpForNext,
      goal: goalFor(masteryOf(all, this.progress.statuses)),
      topics: topics.map((t) => ({ title: t.title, mastered: t.mastered, total: t.total })),
    };
  }

  private async showProfile(): Promise<void> {
    const room = this.current;
    const store = this.store;
    let games: Awaited<ReturnType<GameStore['listGames']>> = [];
    let loadError: string | undefined;
    showLoader();
    try {
      games = await store.listGames(room.def.id);
    } catch {
      loadError = 'Não foi possível carregar seu histórico agora.';
    }
    await this.loadProgress();
    hideLoader();

    this.game.scene.stop('MenuScene');
    this.menu.showProfile(
      {
        roomTitle: room.def.title,
        stats: { ...computeStats(games), totalXp: this.progress.totalXp || computeStats(games).totalXp },
        progress: this.profileProgress(),
        wrongCount: this.wrongIds().length,
        games,
        modeTitle: (id) => getMode(room.def.modes, id)?.title ?? id,
        styleTitle: (style) => getStyle(style).title,
        storageKind: store.kind,
        loadError,
      },
      { onBack: () => void this.showHome() },
    );
  }
}
