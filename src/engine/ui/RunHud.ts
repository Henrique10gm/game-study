// Top-of-viewport HUD for the Flappy-Quiz run: lives, mode, barriers until the
// next question, question progress (a pixel bar), XP, the streak of correct
// answers and the current speed. DOM-only (createElement/textContent), same
// XSS-safety convention as Hud/DialogueOverlay.
import './hud.css';
import './pixel.css';
import { pixelBar } from './pixelBar';
import type { GameStyle } from '../styles';

export interface RunHudData {
  lives: number;
  maxLives: number;
  modeTitle: string;
  barriersToQuestion: number;
  questionsAnswered: number;
  questionTotal: number;
  xpTotal: number;
  streak: number; // correct answers in a row
  speedPct: number; // barrier speed relative to the start, in %
}

export class RunHud {
  private readonly container: HTMLElement;
  private readonly livesChip: HTMLElement;
  private readonly modeChip: HTMLElement;
  private readonly barrierChip: HTMLElement;
  private readonly questionChip: HTMLElement;
  private readonly paceChip: HTMLElement;
  private readonly streakChip: HTMLElement;
  private readonly xpChip: HTMLElement;
  private menuButton: HTMLButtonElement | null = null;
  private lastXpTotal: number | null = null;
  private unit: [string, string] = ['barreira', 'barreiras'];

  constructor(root: HTMLElement, onMenu?: () => void) {
    const container = document.createElement('div');
    container.dataset.testid = 'run-hud';
    container.className = 'hud';

    const make = (testId: string, className: string): HTMLElement => {
      const chip = document.createElement('div');
      chip.dataset.testid = testId;
      chip.className = className;
      container.appendChild(chip);
      return chip;
    };

    this.livesChip = make('hud-lives', 'hud-chip hud-chip--lives');
    this.modeChip = make('hud-mode', 'hud-chip hud-chip--muted hud-chip--mode');
    this.barrierChip = make('hud-barriers', 'hud-chip hud-chip--muted');
    this.questionChip = make('hud-questions', 'hud-chip hud-chip--progress');
    this.paceChip = make('hud-pace', 'hud-chip hud-chip--muted');
    this.streakChip = make('hud-streak', 'hud-chip hud-chip--streak');
    this.xpChip = make('hud-xp', 'hud-chip hud-chip--xp');

    if (onMenu) {
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.dataset.testid = 'hud-menu';
      menu.className = 'hud-chip hud-chip--button';
      menu.textContent = 'Menu';
      menu.addEventListener('click', onMenu);
      // Space/Enter on a focused button must not trigger a flap.
      menu.addEventListener('keydown', (event) => event.stopPropagation());
      container.appendChild(menu);
      this.menuButton = menu;
    }

    root.appendChild(container);
    this.container = container;
  }

  update(data: RunHudData): void {
    const full = '♥'.repeat(Math.max(0, data.lives));
    const empty = '♡'.repeat(Math.max(0, data.maxLives - data.lives));
    this.livesChip.textContent = `${full}${empty}`;
    this.modeChip.textContent = data.modeTitle;
    this.barrierChip.textContent = `Pergunta em ${data.barriersToQuestion} ${this.unit[data.barriersToQuestion === 1 ? 0 : 1]}`;
    this.paceChip.textContent = `Velocidade ${data.speedPct}%`;

    const fraction = data.questionTotal > 0 ? data.questionsAnswered / data.questionTotal : 0;
    this.questionChip.replaceChildren(
      pixelBar(fraction, Math.min(12, Math.max(1, data.questionTotal)), 'px-bar--thin'),
      document.createTextNode(`${data.questionsAnswered}/${data.questionTotal}`),
    );

    this.streakChip.style.display = data.streak >= 2 ? '' : 'none';
    this.streakChip.textContent = `Combo ×${data.streak}`;
    this.xpChip.textContent = `${data.xpTotal} XP`;

    if (this.lastXpTotal !== null && data.xpTotal > this.lastXpTotal) {
      this.xpChip.classList.remove('hud-chip--xp-bump');
      void this.xpChip.offsetWidth;
      this.xpChip.classList.add('hud-chip--xp-bump');
    }
    this.lastXpTotal = data.xpTotal;
  }

  /** Contra o tempo has no barriers and no speed: hide those chips. */
  setStyle(style: GameStyle): void {
    this.unit = style === 'pacman' ? ['moeda', 'moedas'] : ['barreira', 'barreiras'];
    const show = style !== 'tempo';
    this.barrierChip.style.display = show ? '' : 'none';
    this.paceChip.style.display = show ? '' : 'none';
  }

  setVisible(visible: boolean): void {
    this.container.style.display = visible ? '' : 'none';
  }

  setMenuEnabled(enabled: boolean): void {
    if (this.menuButton) this.menuButton.disabled = !enabled;
  }

  unmount(): void {
    this.container.remove();
  }
}
