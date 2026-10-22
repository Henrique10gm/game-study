// Day / night switch. A plain button (aria-pressed = day) in the bottom-right corner.
import { appCorner } from './corner';
import { currentTheme, THEME_EVENT, toggleTheme } from '../theme';

const LABELS = { day: 'Tema claro. Mudar para escuro', night: 'Tema escuro. Mudar para claro' } as const;

export function mountThemeToggle(root: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'app-corner-btn';
  button.dataset.testid = 'theme-toggle';

  const refresh = (): void => {
    const theme = currentTheme();
    button.textContent = theme === 'day' ? '☀ Dia' : '☾ Noite';
    button.setAttribute('aria-label', LABELS[theme]);
    button.setAttribute('aria-pressed', String(theme === 'day'));
  };
  refresh();

  button.addEventListener('click', () => {
    toggleTheme();
    refresh();
  });
  // Another part of the page may switch the theme too (e.g. the landing menu).
  window.addEventListener(THEME_EVENT, refresh);

  appCorner(root).appendChild(button);
  return button;
}
