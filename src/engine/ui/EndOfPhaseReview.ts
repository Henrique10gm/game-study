// Full-screen end-of-run summary + review of the wrong answers. DOM-only
// (createElement/textContent) — same XSS-safety convention as DialogueOverlay.
// Question text always comes from the ReviewItem arguments, never as a literal;
// only UI copy is hardcoded here. Resolves only when the player picks an action.
import './review.css';
import './pixel.css';
import { characterAvatar } from './avatar';
import { pixelBar } from './pixelBar';

export interface ReviewItem {
  summary: string;
  chosenText: string;
  correctText: string;
  explanation: string;
}

export interface ReviewAction {
  id: string;
  label: string;
  primary?: boolean;
}

/** What this run changed in the player's progress ("Sua evolução"). */
export interface EvolutionView {
  pctBefore: number;
  pctAfter: number;
  stageName: string;
  stageUp: boolean;
  masteredDelta: number;
  mastered: number;
  total: number;
  level: number;
  levelUp: boolean;
  xpIntoLevel: number;
  xpForNext: number;
  goal: string;
}

/** A character with a word about the run. */
export interface ReviewCameo {
  name: string;
  role: string;
  frame: number;
  mug?: boolean;
  line: string;
}

export interface ReviewData {
  headerLine: string;
  xp: number;
  statsLine?: string;
  evolution?: EvolutionView;
  cameo?: ReviewCameo;
  title: string;
  items: ReviewItem[];
  emptyBody: string;
  actions: ReviewAction[];
}

export class EndOfPhaseReview {
  private readonly root: HTMLElement;
  private section: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private rank: HTMLElement | null = null;
  private focus: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(data: ReviewData): Promise<string> {
    this.unmount();

    return new Promise((resolve) => {
      const section = document.createElement('section');
      section.dataset.testid = 'review-screen';
      section.className = 'review-screen';

      const content = document.createElement('div');
      content.className = 'review-content';

      const header = document.createElement('div');
      header.className = 'review-header';

      const headerLine = document.createElement('p');
      headerLine.className = 'review-header-line';
      headerLine.textContent = data.headerLine;
      header.appendChild(headerLine);

      const xp = document.createElement('p');
      xp.dataset.testid = 'review-phase-xp';
      xp.className = 'review-phase-xp';
      xp.textContent = `${data.xp} XP`;
      header.appendChild(xp);

      if (data.statsLine) {
        const stats = document.createElement('p');
        stats.dataset.testid = 'review-stats';
        stats.className = 'review-stats';
        stats.textContent = data.statsLine;
        header.appendChild(stats);
      }

      const status = document.createElement('p');
      status.dataset.testid = 'review-status';
      status.className = 'review-status';
      header.appendChild(status);
      this.status = status;

      const rank = document.createElement('p');
      rank.dataset.testid = 'review-rank';
      rank.className = 'review-rank';
      header.appendChild(rank);
      this.rank = rank;

      const focus = document.createElement('p');
      focus.dataset.testid = 'review-focus';
      focus.className = 'review-rank';
      header.appendChild(focus);
      this.focus = focus;

      const title = document.createElement('h2');
      title.dataset.testid = 'review-title';
      title.className = 'review-title';
      title.textContent = data.title;

      content.appendChild(header);

      if (data.evolution) content.appendChild(this.buildEvolution(data.evolution));
      if (data.cameo) content.appendChild(this.buildCameo(data.cameo));
      // The list heading sits right above the list it names (result first, then what to review).
      content.appendChild(title);

      if (data.items.length === 0) {
        const empty = document.createElement('div');
        empty.dataset.testid = 'review-empty';
        empty.className = 'review-empty';

        const emptyHeading = document.createElement('p');
        emptyHeading.className = 'review-empty-heading';
        emptyHeading.textContent = 'Zero erros.';
        empty.appendChild(emptyHeading);

        const emptyBody = document.createElement('p');
        emptyBody.className = 'review-empty-body';
        emptyBody.textContent = data.emptyBody;
        empty.appendChild(emptyBody);

        content.appendChild(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'review-list';
        for (const item of data.items) {
          list.appendChild(this.buildReviewItem(item));
        }
        content.appendChild(list);
      }

      const footer = document.createElement('div');
      footer.className = 'review-footer';

      let firstButton: HTMLButtonElement | null = null;
      for (const action of data.actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.testid = `review-action-${action.id}`;
        button.className = action.primary ? 'review-cta' : 'review-cta review-cta--secondary';
        button.textContent = action.label;
        button.addEventListener('click', () => resolve(action.id));
        footer.appendChild(button);
        if (action.primary || !firstButton) firstButton = button;
      }

      content.appendChild(footer);
      section.appendChild(content);

      this.root.appendChild(section);
      this.section = section;
      firstButton?.focus();
    });
  }

  /** Study-habit line: today's goal and the streak. */
  setFocus(text: string): void {
    if (this.focus) this.focus.textContent = text;
  }

  setStatus(text: string): void {
    if (this.status) this.status.textContent = text;
  }

  private buildCameo(cameo: ReviewCameo): HTMLElement {
    const box = document.createElement('div');
    box.dataset.testid = 'review-cameo';
    box.className = 'review-cameo review-reveal';
    box.appendChild(characterAvatar(cameo.frame, 3, cameo.mug));
    const text = document.createElement('div');
    const who = document.createElement('p');
    who.className = 'review-cameo-who';
    who.textContent = `${cameo.name} · ${cameo.role}`;
    const line = document.createElement('p');
    line.className = 'review-cameo-line';
    line.textContent = cameo.line;
    text.append(who, line);
    box.appendChild(text);
    return box;
  }

  /** Ranking position line, filled in once the server answers. */
  setRank(text: string): void {
    if (this.rank) this.rank.textContent = text;
  }

  private buildEvolution(view: EvolutionView): HTMLElement {
    const box = document.createElement('div');
    box.dataset.testid = 'review-evolution';
    box.className = 'review-evolution px-box review-reveal';

    const make = (tag: 'p' | 'span', className: string, text: string, testId?: string): HTMLElement => {
      const node = document.createElement(tag);
      node.className = className;
      node.textContent = text;
      if (testId) node.dataset.testid = testId;
      return node;
    };

    const label = make('p', 'review-evolution-sub', 'SUA EVOLUÇÃO');
    label.style.letterSpacing = '0.12em';
    label.style.fontWeight = '800';
    box.appendChild(label);

    const head = document.createElement('div');
    head.className = 'review-evolution-head';
    head.appendChild(make('span', 'review-evolution-pct', `${view.pctAfter}%`, 'evolution-pct'));
    head.appendChild(make('span', 'px-tag', view.stageName, 'evolution-stage'));
    const delta = view.masteredDelta;
    head.appendChild(
      make(
        'span',
        'review-evolution-delta',
        delta > 0
          ? `+${delta} ${delta === 1 ? 'questão dominada' : 'questões dominadas'}`
          : delta < 0
            ? `${delta} ${delta === -1 ? 'questão dominada' : 'questões dominadas'}`
            : 'Nenhuma questão nova dominada',
        'evolution-delta',
      ),
    );
    box.appendChild(head);

    box.appendChild(pixelBar(view.pctAfter / 100, 20, '', view.pctBefore / 100));
    box.appendChild(
      make('p', 'review-evolution-sub', `${view.mastered} de ${view.total} questões dominadas`),
    );

    if (view.stageUp) {
      box.appendChild(make('p', 'review-evolution-line', `Novo estágio: ${view.stageName}.`, 'evolution-stage-up'));
    }
    if (view.levelUp) {
      box.appendChild(make('p', 'review-evolution-line', `Nível ${view.level} alcançado.`, 'evolution-level-up'));
    } else {
      box.appendChild(
        make('p', 'review-evolution-sub', `Nível ${view.level} · ${view.xpIntoLevel} de ${view.xpForNext} XP`),
      );
    }
    box.appendChild(make('p', 'review-evolution-line', view.goal, 'evolution-goal'));

    return box;
  }

  private buildReviewItem(record: ReviewItem): HTMLElement {
    const item = document.createElement('div');
    item.dataset.testid = 'review-item';
    item.className = 'review-item';

    const make = (testId: string, className: string, text: string): void => {
      const p = document.createElement('p');
      p.dataset.testid = testId;
      p.className = className;
      p.textContent = text;
      item.appendChild(p);
    };

    make('review-item-summary', 'review-item-summary', record.summary);
    make('review-item-chosen', 'review-item-chosen', `Sua escolha: ${record.chosenText}`);
    make('review-item-correct', 'review-item-correct', `Resposta certa: ${record.correctText}`);
    make('review-item-explanation', 'review-item-explanation', record.explanation);
    return item;
  }

  unmount(): void {
    if (this.section) {
      this.section.remove();
      this.section = null;
      this.status = null;
      this.rank = null;
      this.focus = null;
    }
  }
}
