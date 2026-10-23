// "Sua conta": download your data, read the privacy policy, delete the account. Opens from a
// small "Conta" button in the corner. Deleting asks for a typed word and says exactly what goes.
import './account.css';
import { AccountError, DELETE_PHRASE, exportFileName } from '../../state/AccountService';
import type { AccountApi } from '../../state/AccountService';
import { appCorner } from './corner';

export interface AccountScreenOptions {
  api: AccountApi;
  email: string | null;
  /** Saves a text file in the player's computer (replaced in tests). */
  download?: (fileName: string, content: string) => void;
  /** What to do once the account is gone (default: back to the start page). */
  onDeleted?: () => void;
  policyUrl?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string, testId?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (testId) node.dataset.testid = testId;
  return node;
}

export function saveTextFile(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class AccountScreen {
  private overlay: HTMLElement | null = null;
  private opener: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: AccountScreenOptions,
  ) {}

  /** Adds the "Conta" button to the corner of the screen. */
  mountButton(): HTMLButtonElement {
    const button = el('button', 'app-corner-btn', 'Conta', 'account-open');
    button.type = 'button';
    button.addEventListener('click', () => this.open(button));
    appCorner(this.root).prepend(button);
    return button;
  }

  open(opener: HTMLElement | null = null): void {
    if (this.overlay) return;
    this.opener = opener;
    const { api, email } = this.opts;
    const download = this.opts.download ?? saveTextFile;
    const onDeleted = this.opts.onDeleted ?? (() => window.location.assign(window.location.pathname));

    const overlay = el('div', 'acc-overlay', undefined, 'account-screen');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'acc-title');
    const card = el('div', 'acc-card px-box');
    overlay.appendChild(card);

    card.appendChild(el('h2', 'acc-title', 'Sua conta')).id = 'acc-title';
    if (email) card.appendChild(el('p', 'acc-email', email, 'account-email'));

    const status = el('p', 'acc-status', '', 'account-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const say = (text: string, ok = false): void => {
      status.textContent = text;
      status.classList.toggle('is-ok', ok);
    };
    const messageOf = (error: unknown): string =>
      error instanceof AccountError ? error.message : 'Não foi possível concluir agora. Tente de novo.';

    // ---- your data
    card.appendChild(el('h3', 'acc-h3', 'Seus dados'));
    card.appendChild(
      el(
        'p',
        'acc-text',
        'Baixe uma cópia de tudo o que guardamos sobre você: conta, apelido, grupos, partidas, respostas, tempo de uso e reportes. É um arquivo JSON.',
      ),
    );
    const exportButton = el('button', 'menu-btn acc-btn', 'Baixar meus dados', 'account-export');
    exportButton.type = 'button';
    exportButton.addEventListener('click', () => {
      exportButton.disabled = true;
      say('Reunindo os seus dados…');
      void api
        .exportData()
        .then((data) => {
          download(exportFileName(), JSON.stringify(data, null, 2));
          say('Pronto: o arquivo foi baixado.', true);
        })
        .catch((error) => say(messageOf(error)))
        .finally(() => {
          exportButton.disabled = false;
        });
    });
    card.appendChild(exportButton);

    const policy = el('a', 'acc-link', 'Ler a política de privacidade', 'account-policy');
    policy.href = this.opts.policyUrl ?? './privacidade.html';
    policy.target = '_blank';
    policy.rel = 'noopener';
    card.appendChild(el('p', 'acc-text')).appendChild(policy);

    // ---- delete
    card.appendChild(el('h3', 'acc-h3 acc-h3--danger', 'Excluir a conta'));
    card.appendChild(
      el(
        'p',
        'acc-text',
        'Apaga a sua conta e tudo o que está ligado a ela: apelido, partidas, respostas, tempo de uso, reportes e as suas participações em grupos. Não dá para desfazer.',
      ),
    );
    card.appendChild(
      el('p', 'acc-text acc-text--warn', 'Se você criou algum grupo, ele também é apagado, e os outros membros perdem o acesso a ele.'),
    );
    const label = el('label', 'acc-field');
    label.appendChild(el('span', 'acc-label', `Para confirmar, digite ${DELETE_PHRASE}`));
    const input = el('input', 'acc-input', undefined, 'account-confirm');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    label.appendChild(input);
    card.appendChild(label);
    const deleteButton = el('button', 'acc-btn acc-btn--danger', 'Excluir minha conta para sempre', 'account-delete');
    deleteButton.type = 'button';
    deleteButton.disabled = true;
    input.addEventListener('input', () => {
      deleteButton.disabled = input.value.trim() !== DELETE_PHRASE;
    });
    deleteButton.addEventListener('click', () => {
      if (input.value.trim() !== DELETE_PHRASE) return;
      deleteButton.disabled = true;
      input.disabled = true;
      exportButton.disabled = true;
      say('Excluindo a conta…');
      void api
        .deleteAccount()
        .then(() => {
          say('Conta excluída. Voltando para o início…', true);
          window.setTimeout(onDeleted, 1200);
        })
        .catch((error) => {
          say(messageOf(error));
          input.disabled = false;
          exportButton.disabled = false;
          deleteButton.disabled = input.value.trim() !== DELETE_PHRASE;
        });
    });
    card.appendChild(deleteButton);
    card.appendChild(status);

    const close = el('button', 'menu-btn menu-btn--secondary acc-btn', 'Fechar', 'account-close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    card.appendChild(close);

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    });
    this.root.appendChild(overlay);
    this.overlay = overlay;
    exportButton.focus();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.opener?.focus();
    this.opener = null;
  }
}
