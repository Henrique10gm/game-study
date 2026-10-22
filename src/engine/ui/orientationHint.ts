// On a phone held upright the 960x640 game is shown complete but small. A quiet
// hint at the bottom suggests turning the phone; it goes away on its own when the
// phone is turned, and the player can dismiss it. DOM-only (createElement/textContent).
import './orientation-hint.css';

export function isUprightPhone(width: number, height: number): boolean {
  return width < 700 && height > width * 1.1;
}

export function watchOrientation(root: HTMLElement): void {
  let dismissed = false;
  let hint: HTMLElement | null = null;

  const remove = (): void => {
    hint?.remove();
    hint = null;
  };

  const update = (): void => {
    const upright = isUprightPhone(window.innerWidth, window.innerHeight);
    if (!upright || dismissed) {
      remove();
      return;
    }
    if (hint) return;
    hint = document.createElement('div');
    hint.className = 'orientation-hint';
    hint.dataset.testid = 'orientation-hint';
    const text = document.createElement('span');
    text.textContent = 'Vire o celular para jogar em tela maior.';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fechar';
    close.addEventListener('click', () => {
      dismissed = true;
      remove();
    });
    hint.append(text, close);
    root.appendChild(hint);
  };

  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();
}
