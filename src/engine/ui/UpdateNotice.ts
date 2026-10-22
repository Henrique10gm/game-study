// "O que há de novo" card shown over the game once after an update. DOM-only
// (createElement/textContent). While it is open it keeps the game's own keys
// (walking, Enter at the door) from reacting; Enter, Space or Escape close it.
import './update-notice.css';
import './pixel.css';
import type { GameUpdate } from '../updates';

export class UpdateNotice {
  private section: HTMLElement | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly root: HTMLElement) {}

  /** Resolves when the player closes the card. */
  show(update: GameUpdate): Promise<void> {
    this.close();
    return new Promise((resolve) => {
      const section = document.createElement('section');
      section.className = 'upd';
      section.dataset.testid = 'update-notice';
      section.setAttribute('role', 'dialog');
      section.setAttribute('aria-modal', 'true');
      section.setAttribute('aria-label', update.title);

      const card = document.createElement('div');
      card.className = 'upd-card px-box px-box--lime';

      const kicker = document.createElement('p');
      kicker.className = 'upd-kicker';
      kicker.textContent = `Atualização · ${update.date}`;
      card.appendChild(kicker);

      const title = document.createElement('h2');
      title.className = 'upd-title';
      title.textContent = update.title;
      card.appendChild(title);

      card.appendChild(this.list(update.highlights, 'upd-list'));

      if (update.also && update.also.length > 0) {
        const also = document.createElement('p');
        also.className = 'upd-also-title';
        also.textContent = 'Também chegou';
        card.appendChild(also);
        card.appendChild(this.list(update.also, 'upd-list upd-list--small'));
      }

      const finish = (): void => {
        this.close();
        resolve();
      };
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'upd-btn';
      go.dataset.testid = 'update-notice-go';
      go.textContent = 'Bora jogar';
      go.addEventListener('click', finish);
      const actions = document.createElement('div');
      actions.className = 'upd-actions';
      actions.appendChild(go);
      card.appendChild(actions);

      section.appendChild(card);
      this.root.appendChild(section);
      this.section = section;
      go.focus();

      this.keyHandler = (event: KeyboardEvent) => {
        // Capture phase: nothing behind the card may see a key while it is open.
        if (event.code === 'Tab') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat && ['Enter', 'NumpadEnter', 'Space', 'Escape'].includes(event.code)) finish();
      };
      window.addEventListener('keydown', this.keyHandler, true);
    });
  }

  private list(items: readonly string[], className: string): HTMLElement {
    const list = document.createElement('ul');
    list.className = className;
    for (const item of items) {
      const row = document.createElement('li');
      row.textContent = item;
      list.appendChild(row);
    }
    return list;
  }

  private close(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
    this.section?.remove();
    this.section = null;
  }
}
