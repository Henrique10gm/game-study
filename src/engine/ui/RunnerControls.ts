// On-screen buttons for Corrida on touch screens: "Agachar" (hold) on the left
// and "Pular" on the right, big enough for thumbs. DOM-only (createElement /
// textContent). On a computer the keyboard is enough, so nothing is shown.
import './runner-controls.css';

export interface RunnerControlHandlers {
  onJump(): void;
  onDuck(held: boolean): void;
}

export class RunnerControls {
  private readonly container: HTMLElement;

  /** True on devices whose main pointer is a finger. */
  static isNeeded(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  }

  constructor(root: HTMLElement, handlers: RunnerControlHandlers) {
    this.container = document.createElement('div');
    this.container.className = 'runner-controls';
    this.container.dataset.testid = 'runner-controls';

    const duck = this.button('Agachar', 'runner-duck');
    const press = (event: Event): void => {
      event.preventDefault();
      handlers.onDuck(true);
    };
    const release = (event: Event): void => {
      event.preventDefault();
      handlers.onDuck(false);
    };
    duck.addEventListener('pointerdown', press);
    duck.addEventListener('pointerup', release);
    duck.addEventListener('pointercancel', release);
    duck.addEventListener('pointerleave', release);

    const jump = this.button('Pular', 'runner-jump');
    jump.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handlers.onJump();
    });

    this.container.append(duck, jump);
    root.appendChild(this.container);
  }

  private button(label: string, testId: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'runner-btn';
    button.dataset.testid = testId;
    button.textContent = label;
    // Keyboard focus on a button would make Space press it: the game handles keys itself.
    button.tabIndex = -1;
    return button;
  }

  destroy(): void {
    this.container.remove();
  }
}
