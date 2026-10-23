// In-world menu shown inside the bank scene: the game modes (or the question
// counts) stacked in the middle of the screen. Hovering or moving with the
// arrow keys shows what each entry is. A side card shows how ready the player
// is for the exam. DOM-only (createElement/textContent), laid out in the game's
// 960x640 design space and scaled to sit exactly over the Phaser canvas, so the
// character on the left stays visible.
import './bank-menu.css';
import './pixel.css';
import { BRAND, BRAND_SPOKEN } from '../../brand';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { SizeOption } from '../modes';
import type { FocusView } from '../focus';
import { canFullscreen, isFullscreen, onFullscreenChange, toggleFullscreen } from './fullscreen';
import type { SecretsView } from '../secrets';
import { pixelBar } from './pixelBar';

export interface HomeMode {
  id: string;
  title: string;
  description: string;
  count: number; // questions available
  mastered?: number; // of those, how many the player already masters
  disabledReason?: string;
}

/** What the "Sua preparação" card shows (all numbers computed by the app). */
export interface ReadinessView {
  pct: number;
  stageName: string;
  ready: boolean;
  mastered: number;
  total: number;
  examLabel?: string; // the room's exam line ("Prova ABT1"); none = no exam in this room
  examMastered: number;
  examTotal: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
}

/** The Hall da Fama preview card (top of the ranking, and where you stand). */
export interface HallView {
  available: boolean; // false when the game has no server
  entries: { rank: number; nickname: string; mastered: number; me: boolean; ghost?: boolean }[]; // ghost: your row before you pick a nickname
  me: { nickname: string | null; rank: number | null };
  total: number; // players in the Hall da Fama
  status?: 'loading' | 'error'; // the list is still on its way, or could not be fetched
}

export interface HomeData {
  room: { title: string; kicker: string; menuTitle: string };
  modes: HomeMode[];
  notice?: string;
  storageKind: 'local' | 'cloud';
  readiness?: ReadinessView;
  hall?: HallView;
  focus?: FocusView;
}

/** The game styles offered after choosing the topic. */
export interface StyleData {
  modeTitle: string;
  styles: { id: string; title: string; description: string }[];
}

export interface SizeData {
  modeTitle: string;
  options: SizeOption[];
}

interface Entry {
  testId: string;
  label: string;
  detail: string;
  meta?: string; // right-aligned note on the row (e.g. "12/24")
  progress?: number; // 0..1, small bar under the label
  disabled?: boolean;
  secondary?: boolean;
  onSelect(): void;
}

interface ListView {
  kicker: string;
  title: string;
  note?: string;
  entries: Entry[];
  onBack?: () => void;
}

export interface HomeHandlers {
  onPick(id: string): void;
  onRanking(): void;
  onProfile(): void;
  onBack(): void; // back to the hall of rooms
}

// Text wordmark in the top-right corner (small, never centered): "quest" light,
// "hall" bold. Swap for a logo SVG when one is added to the project.
function buildWordmark(): HTMLElement {
  const logo = document.createElement('div');
  logo.className = 'bank-logo';
  logo.setAttribute('aria-label', BRAND_SPOKEN);
  const part = (className: string, text: string): HTMLElement => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  };
  logo.appendChild(part('bank-logo-light', BRAND.light));
  logo.appendChild(part('bank-logo-bold', BRAND.bold));
  return logo;
}

function text(tag: 'p' | 'div' | 'span' | 'h1', className: string, content: string, testId?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  if (testId) node.dataset.testid = testId;
  return node;
}

function buildReadinessCard(view: ReadinessView): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'bank-card px-box';
  card.dataset.testid = 'readiness-card';

  card.appendChild(text('p', 'bank-kicker', 'Sua preparação'));
  const pct = text('p', 'bank-pct', `${view.pct}%`, 'readiness-pct');
  card.appendChild(pct);
  card.appendChild(text('span', 'px-tag', view.stageName, 'readiness-stage'));
  card.appendChild(pixelBar(view.pct / 100, 20));
  card.appendChild(
    text('p', 'bank-card-line', `${view.mastered} de ${view.total} questões dominadas`, 'readiness-mastered'),
  );
  if (view.examLabel && view.examTotal > 0) {
    card.appendChild(text('p', 'bank-card-line', `${view.examLabel}: ${view.examMastered} de ${view.examTotal}`));
  }

  const level = document.createElement('div');
  level.className = 'bank-level';
  level.appendChild(text('p', 'bank-card-line', `Nível ${view.level}`, 'level-label'));
  level.appendChild(pixelBar(view.xpIntoLevel / view.xpForNext, 10, 'px-bar--thin'));
  level.appendChild(text('p', 'bank-card-sub', `${view.xpIntoLevel} de ${view.xpForNext} XP para o próximo`));
  card.appendChild(level);
  return card;
}

/** "Foco de hoje": the daily goal and the streak of days in a row. */
function buildFocusCard(view: FocusView): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'bank-card bank-focus px-box';
  card.dataset.testid = 'focus-card';

  card.appendChild(text('p', 'bank-kicker', 'Foco de hoje'));
  const streak = view.streak === 0 ? 'Sem ofensiva ainda' : view.streak === 1 ? '1 dia seguido' : `${view.streak} dias seguidos`;
  card.appendChild(text('p', view.atRisk ? 'bank-streak is-risk' : 'bank-streak', streak, 'focus-streak'));
  card.appendChild(pixelBar(Math.min(1, view.today / view.goal), 10, 'px-bar--thin'));
  card.appendChild(text('p', 'bank-card-line', `${Math.min(view.today, view.goal)} de ${view.goal} questões hoje`, 'focus-today'));
  card.appendChild(text('p', 'bank-card-sub', view.line, 'focus-line'));
  if (view.best > 1) card.appendChild(text('p', 'bank-card-sub', `Recorde: ${view.best} dias`));
  return card;
}

function buildHallCard(view: HallView, onOpen: () => void): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'bank-hall px-box';
  card.dataset.testid = 'hall-card';

  card.appendChild(text('p', 'bank-kicker', 'Hall da Fama'));

  if (!view.available) {
    card.appendChild(text('p', 'bank-card-sub', 'Disponível com uma conta e um grupo (veja a tela de ranking).', 'hall-unavailable'));
    return card;
  }

  if (view.status === 'loading') {
    card.appendChild(text('p', 'bank-card-sub', 'Carregando a lista…', 'hall-loading'));
  } else if (view.status === 'error') {
    card.appendChild(text('p', 'bank-card-sub', 'Não consegui carregar a lista agora. Tente de novo em instantes.', 'hall-error'));
  } else if (view.entries.length === 0) {
    card.appendChild(text('p', 'bank-card-sub', 'Ninguém na lista ainda. Seja a primeira pessoa.', 'hall-empty'));
  } else {
    const list = document.createElement('ol');
    list.className = 'bank-hall-list';
    for (const entry of view.entries) {
      const row = document.createElement('li');
      row.className = entry.me ? 'bank-hall-row is-me' : 'bank-hall-row';
      row.dataset.testid = 'hall-row';
      row.append(
        text('span', 'bank-hall-pos', `${entry.rank}º`),
        text('span', 'bank-hall-name', entry.ghost ? 'Você (sem apelido)' : entry.me ? `${entry.nickname} (você)` : entry.nickname),
        text('span', 'bank-hall-score', String(entry.mastered)),
      );
      list.appendChild(row);
    }
    card.appendChild(list);
    // Five rows are visible; the rest scrolls. Start with your own row centered.
    const mine = list.querySelector<HTMLElement>('.is-me');
    if (mine) {
      requestAnimationFrame(() => {
        list.scrollTop = Math.max(0, mine.offsetTop - (list.clientHeight - mine.offsetHeight) / 2);
      });
    }
    if (view.entries.length === 1 && view.entries[0].me) {
      card.appendChild(text('p', 'bank-card-sub', 'Só você na lista por enquanto.', 'hall-alone'));
    }
  }

  const listed = view.entries.some((e) => e.me);
  if (view.status) {
    // nickname unknown until the list arrives: no invitation yet
  } else if (view.me.nickname === null) {
    card.appendChild(text('p', 'bank-card-sub', 'Escolha um apelido para entrar na lista.', 'hall-join'));
  } else if (!listed && view.me.rank !== null) {
    card.appendChild(text('p', 'bank-card-line', `Você: ${view.me.rank}º`, 'hall-me'));
  }

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'bank-hall-open';
  open.dataset.testid = 'hall-open';
  open.textContent = view.me.nickname === null && !view.status ? 'Escolher apelido' : 'Ver tudo';
  open.addEventListener('click', onOpen);
  open.addEventListener('keydown', (event) => event.stopPropagation()); // keep the list's arrow/Enter handling out
  card.appendChild(open);
  return card;
}

export class BankMenu {
  private readonly stage: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private panel: HTMLElement | null = null;
  private card: HTMLElement | null = null;
  private hallCard: HTMLElement | null = null;
  private focusCard: HTMLElement | null = null;
  private secretsChip: HTMLElement;
  private stopFullscreenWatch: (() => void) | null = null;
  private onHallOpen: (() => void) | null = null;
  private items: HTMLButtonElement[] = [];
  private details: string[] = [];
  private detailBox: HTMLElement | null = null;
  private view: ListView | null = null;
  private active = 0;

  constructor(
    private readonly root: HTMLElement,
    canvas: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    this.stage = document.createElement('div');
    this.stage.className = 'bank-stage';
    this.stage.dataset.testid = 'bank-menu';
    this.stage.style.width = `${GAME_WIDTH}px`;
    this.stage.style.height = `${GAME_HEIGHT}px`;
    this.stage.hidden = true;
    this.stage.appendChild(buildWordmark());
    this.secretsChip = text('p', 'bank-secrets', '', 'secrets-chip');
    this.secretsChip.hidden = true;
    this.stage.appendChild(this.secretsChip);
    if (canFullscreen()) this.buildFullscreenButton();
    this.root.appendChild(this.stage);
    window.addEventListener('resize', this.layout);
    window.addEventListener('keydown', this.onKeyDown);
  }

  // "Tela cheia" next to the logo; Esc leaves it (the F key works anywhere).
  private buildFullscreenButton(): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bank-fs';
    button.dataset.testid = 'fullscreen-toggle';
    const refresh = (): void => {
      button.textContent = isFullscreen() ? 'Sair da tela cheia' : 'Tela cheia (F)';
    };
    refresh();
    button.addEventListener('click', () => void toggleFullscreen());
    button.addEventListener('keydown', (event) => event.stopPropagation()); // keep the list's Enter handling out
    this.stopFullscreenWatch = onFullscreenChange(refresh);
    this.stage.appendChild(button);
  }

  // Keep the 960x640 stage glued to wherever the canvas is on screen.
  // On a big canvas the 960x640 stage is scaled to sit over it. On a small one
  // (phones, small tablets) scaling would make the text unreadable, so the menu
  // becomes a normal full-screen scrolling column instead.
  layout = (): void => {
    const canvasRect = this.canvas.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    const scale = canvasRect.width / GAME_WIDTH || 1;
    const compact = scale < 0.72;
    this.stage.classList.toggle('bank-stage--compact', compact);
    if (compact) {
      this.stage.style.left = '0px';
      this.stage.style.top = '0px';
      this.stage.style.width = '100%';
      this.stage.style.height = '100%';
      this.stage.style.transform = 'none';
      return;
    }
    this.stage.style.width = `${GAME_WIDTH}px`;
    this.stage.style.height = `${GAME_HEIGHT}px`;
    this.stage.style.left = `${canvasRect.left - rootRect.left}px`;
    this.stage.style.top = `${canvasRect.top - rootRect.top}px`;
    this.stage.style.transform = `scale(${scale})`;
  };

  /** Shows only the corner pieces (logo, fullscreen, secrets) over a scene that has no menu list, like the hall. */
  showChrome(): void {
    this.clear();
    this.stage.classList.add('bank-stage--chrome');
    this.stage.hidden = false;
    this.layout();
  }

  /** "Segredos 3/10": how many hidden things of the bank the player found. */
  setSecrets(view: SecretsView): void {
    this.secretsChip.textContent = `Segredos ${view.found}/${view.total}`;
    this.secretsChip.hidden = false;
  }

  showModes(data: HomeData, handlers: HomeHandlers): void {
    this.onHallOpen = handlers.onRanking;
    const entries: Entry[] = data.modes.map((mode) => ({
      testId: `mode-${mode.id}`,
      label: mode.title,
      detail: mode.disabledReason ?? `${mode.description} (${mode.count} questões)`,
      meta: mode.mastered !== undefined && mode.count > 0 ? `${mode.mastered}/${mode.count}` : undefined,
      progress: mode.mastered !== undefined && mode.count > 0 ? mode.mastered / mode.count : undefined,
      disabled: mode.count === 0,
      onSelect: () => handlers.onPick(mode.id),
    }));
    entries.push({
      testId: 'menu-profile',
      label: 'Meu crachá',
      detail:
        data.storageKind === 'cloud'
          ? 'Seu perfil: missões jogadas, XP, domínio por assunto e questões para revisar. Salvo no servidor interno.'
          : 'Seu perfil: missões jogadas, XP, domínio por assunto e questões para revisar. Salvo só neste navegador.',
      secondary: true,
      onSelect: handlers.onProfile,
    });
    entries.push({
      testId: 'menu-hall-back',
      label: 'Voltar ao salão',
      detail: 'Sair da sala e voltar ao salão de jogos para escolher outra.',
      secondary: true,
      onSelect: handlers.onBack,
    });
    this.show(
      { kicker: data.room.kicker, title: data.room.menuTitle, note: data.notice, entries, onBack: handlers.onBack },
      data.readiness,
      data.hall ? () => buildHallCard(data.hall as HallView, handlers.onRanking) : undefined,
      data.focus,
    );
  }

  showStyles(
    data: StyleData,
    handlers: { onPick(styleId: string): void; onBack(): void },
    readiness?: ReadinessView,
  ): void {
    const entries: Entry[] = data.styles.map((style) => ({
      testId: `style-${style.id}`,
      label: style.title,
      detail: style.description,
      onSelect: () => handlers.onPick(style.id),
    }));
    entries.push({
      testId: 'menu-back',
      label: 'Voltar',
      detail: 'Voltar à escolha da missão.',
      secondary: true,
      onSelect: handlers.onBack,
    });
    this.show({ kicker: 'Modo de jogo', title: data.modeTitle, entries, onBack: handlers.onBack }, readiness);
  }

  showSizes(
    data: SizeData,
    handlers: { onPick(option: SizeOption): void; onBack(): void },
    readiness?: ReadinessView,
  ): void {
    const entries: Entry[] = data.options.map((option) => ({
      testId: `size-${option.complete ? 'complete' : option.count}`,
      label: option.label,
      detail: option.complete
        ? 'Joga todas as questões deste modo, em ordem sorteada.'
        : `Sorteia ${option.count} questões deste modo.`,
      onSelect: () => handlers.onPick(option),
    }));
    entries.push({
      testId: 'menu-back',
      label: 'Voltar',
      detail: 'Voltar à escolha do modo de jogo.',
      secondary: true,
      onSelect: handlers.onBack,
    });
    this.show({ kicker: 'Quantidade', title: data.modeTitle, entries, onBack: handlers.onBack }, readiness);
  }

  private show(view: ListView, readiness?: ReadinessView, hall?: () => HTMLElement, focus?: FocusView): void {
    this.clear();
    this.view = view;
    this.stage.hidden = false;
    this.layout();

    const panel = document.createElement('div');
    panel.className = 'bank-panel px-box';

    panel.appendChild(text('p', 'bank-kicker', view.kicker));
    panel.appendChild(text('h1', 'bank-title', view.title));

    if (view.note) panel.appendChild(text('p', 'bank-note', view.note, 'menu-notice'));

    const list = document.createElement('div');
    list.className = 'bank-list';
    view.entries.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.testid = entry.testId;
      button.className = entry.secondary ? 'bank-item bank-item--secondary' : 'bank-item';
      button.appendChild(text('span', 'bank-item-label', entry.label));
      if (entry.meta) button.appendChild(text('span', 'bank-item-meta', entry.meta));
      if (entry.progress !== undefined) {
        const bar = pixelBar(entry.progress, 24, 'px-bar--thin bank-item-bar');
        button.appendChild(bar);
      }
      if (entry.disabled) button.setAttribute('aria-disabled', 'true');
      button.addEventListener('mouseenter', () => this.setActive(index));
      button.addEventListener('focus', () => this.setActive(index));
      button.addEventListener('click', () => this.select(index));
      list.appendChild(button);
      this.items.push(button);
      this.details.push(entry.detail);
    });
    panel.appendChild(list);

    const detail = text('p', 'bank-detail', '', 'menu-detail');
    detail.setAttribute('aria-live', 'polite');
    panel.appendChild(detail);
    this.detailBox = detail;

    panel.appendChild(text('p', 'bank-hint', '↑ ↓ para escolher · Enter para confirmar'));

    this.stage.appendChild(panel);
    this.panel = panel;

    if (readiness) {
      this.card = buildReadinessCard(readiness);
      this.stage.appendChild(this.card);
    }
    if (focus) {
      this.focusCard = buildFocusCard(focus);
      this.stage.appendChild(this.focusCard);
    }
    if (hall) {
      this.hallCard = hall();
      this.stage.appendChild(this.hallCard);
    }
    this.setActive(0);
  }

  /** Swaps the Hall da Fama card when the list arrives after the menu is already open. */
  setHall(view: HallView): void {
    if (!this.hallCard || !this.onHallOpen) return;
    const next = buildHallCard(view, this.onHallOpen);
    this.hallCard.replaceWith(next);
    this.hallCard = next;
  }

  private setActive(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    this.active = index;
    this.items.forEach((item, i) => item.classList.toggle('is-active', i === index));
    if (this.detailBox) this.detailBox.textContent = this.details[index];
  }

  private select(index: number): void {
    const entry = this.view?.entries[index];
    if (!entry || entry.disabled) return;
    entry.onSelect();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.stage.hidden || !this.view || this.items.length === 0) return;
    if (event.key === 'ArrowDown') {
      this.setActive((this.active + 1) % this.items.length);
    } else if (event.key === 'ArrowUp') {
      this.setActive((this.active - 1 + this.items.length) % this.items.length);
    } else if (event.key === 'Enter') {
      this.select(this.active);
    } else if (event.key === 'Escape' && this.view.onBack) {
      this.view.onBack();
    } else {
      return;
    }
    event.preventDefault();
    this.items[this.active]?.focus({ preventScroll: true });
  };

  private clear(): void {
    this.stage.classList.remove('bank-stage--chrome');
    this.panel?.remove();
    this.card?.remove();
    this.hallCard?.remove();
    this.focusCard?.remove();
    this.focusCard = null;
    this.panel = null;
    this.card = null;
    this.hallCard = null;
    this.items = [];
    this.details = [];
    this.detailBox = null;
    this.view = null;
  }

  hide(): void {
    this.clear();
    this.stage.hidden = true;
  }

  destroy(): void {
    this.hide();
    window.removeEventListener('resize', this.layout);
    window.removeEventListener('keydown', this.onKeyDown);
    this.stopFullscreenWatch?.();
    this.stage.remove();
  }
}
