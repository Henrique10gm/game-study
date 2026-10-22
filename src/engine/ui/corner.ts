// The small controls kept in the bottom-right corner of the screen (theme, sign out).
// One shared container so they sit side by side instead of on top of each other.
import './corner.css';

export function appCorner(root: HTMLElement): HTMLElement {
  const existing = root.querySelector<HTMLElement>(':scope > .app-corner');
  if (existing) return existing;
  const corner = document.createElement('div');
  corner.className = 'app-corner';
  root.appendChild(corner);
  return corner;
}
