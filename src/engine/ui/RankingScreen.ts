// Ranking screen: who has mastered the most questions (XP breaks ties). Only
// players who chose a nickname are listed, and the screen never receives
// anything that identifies a person beyond that nickname. createElement /
// textContent only. All data comes in through arguments; the app decides what
// happens when the nickname form is sent.
import './menu.css';
import './ranking.css';
import './pixel.css';
import type { Leaderboard } from '../../state/records';

export interface RankingData {
  roomTitle?: string; // each room has its own Hall da Fama
  board: Leaderboard;
  totalQuestions: number;
  loadError?: string;
}

export interface RankingHandlers {
  onBack(): void;
  /** Resolves with an error message to show, or null when the nickname was saved. */
  onSaveNickname(nickname: string): Promise<string | null>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  if (testId) node.dataset.testid = testId;
  return node;
}

export class RankingScreen {
  private screen: HTMLElement | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly root: HTMLElement) {}

  show(data: RankingData, handlers: RankingHandlers): void {
    this.hide();
    const screen = el('section', 'menu-screen', undefined, 'ranking-screen');
    const content = el('div', 'menu-content rank-content');
    screen.appendChild(content);

    content.appendChild(el('p', 'menu-kicker', data.roomTitle ? `Ranking · ${data.roomTitle}` : 'Ranking'));
    content.appendChild(el('h1', 'menu-title', 'Hall da Fama'));
    content.appendChild(
      el(
        'p',
        'menu-lead',
        'Ordenado pelas questões dominadas, ou seja, aquelas em que a última resposta foi certa. O XP desempata.',
      ),
    );

    if (data.loadError) content.appendChild(el('p', 'menu-notice', data.loadError, 'ranking-error'));

    if (!data.board.available) {
      content.appendChild(
        el(
          'p',
          'rank-empty',
          'O Hall da Fama funciona quando o jogo é aberto pelo link da empresa. Aqui o seu progresso fica só neste navegador.',
          'ranking-unavailable',
        ),
      );
    } else {
      content.appendChild(this.buildNicknameForm(data, handlers));
      content.appendChild(this.buildTable(data));
    }

    const footer = el('div', 'menu-footer');
    const back = el('button', 'menu-btn menu-btn--secondary', 'Voltar à sala', 'ranking-back');
    back.type = 'button';
    back.addEventListener('click', handlers.onBack);
    footer.appendChild(back);
    content.appendChild(footer);

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlers.onBack();
    };
    window.addEventListener('keydown', this.keyHandler);

    this.root.appendChild(screen);
    this.screen = screen;
  }

  private buildNicknameForm(data: RankingData, handlers: RankingHandlers): HTMLElement {
    const { me } = data.board;
    const form = el('form', 'rank-form px-box', undefined, 'nickname-form');
    form.appendChild(
      el('label', 'rank-form-label', me.nickname ? 'Seu apelido no ranking' : 'Escolha um apelido para entrar no ranking'),
    );

    const row = el('div', 'rank-form-row');
    const input = el('input', 'rank-input', undefined, 'nickname-input');
    input.type = 'text';
    input.maxLength = 20;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = me.nickname ?? '';
    input.setAttribute('aria-label', 'Apelido');
    row.appendChild(input);

    const submit = el('button', 'menu-btn', me.nickname ? 'Salvar apelido' : 'Entrar no ranking', 'nickname-save');
    submit.type = 'submit';
    row.appendChild(submit);
    form.appendChild(row);

    const message = el('p', 'rank-form-message', '', 'nickname-message');
    message.setAttribute('aria-live', 'polite');
    form.appendChild(message);
    form.appendChild(
      el(
        'p',
        'menu-hint',
        'Os colegas veem este apelido, suas questões dominadas, o XP e o número de partidas. 2 a 20 caracteres: letras, números, espaço, ponto, traço ou sublinhado. Não use nome de cliente.',
      ),
    );

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit.disabled = true;
      message.textContent = 'Salvando…';
      void handlers
        .onSaveNickname(input.value)
        .then((problem) => {
          if (problem) {
            message.textContent = problem;
            submit.disabled = false;
          }
        })
        .catch(() => {
          message.textContent = 'Não foi possível salvar agora. Tente de novo.';
          submit.disabled = false;
        });
    });
    return form;
  }

  private buildTable(data: RankingData): HTMLElement {
    const table = el('div', 'rank-table', undefined, 'ranking-table');
    table.setAttribute('role', 'table');

    const head = el('div', 'rank-row rank-row--head');
    head.setAttribute('role', 'row');
    for (const label of ['#', 'Apelido', 'Dominadas', 'XP', 'Jogos']) {
      const cell = el('span', 'rank-cell', label);
      cell.setAttribute('role', 'columnheader');
      head.appendChild(cell);
    }
    table.appendChild(head);

    const { entries, me } = data.board;
    if (entries.length === 0) {
      table.appendChild(
        el('p', 'rank-empty', 'Ninguém no ranking ainda. Escolha um apelido e seja a primeira pessoa da lista.', 'ranking-empty'),
      );
      return table;
    }

    for (const entry of entries) {
      const row = el('div', 'rank-row', undefined, 'ranking-row');
      row.setAttribute('role', 'row');
      if (entry.rank <= 3) row.classList.add('rank-row--top');
      if (entry.me) row.classList.add('rank-row--me');
      const cells = [
        `${entry.rank}º`,
        entry.me ? `${entry.nickname} (você)` : entry.nickname,
        `${entry.mastered}/${data.totalQuestions}`,
        String(entry.xp),
        String(entry.games),
      ];
      cells.forEach((value, index) => {
        const cell = el('span', index === 1 ? 'rank-cell rank-cell--name' : 'rank-cell', value);
        cell.setAttribute('role', 'cell');
        row.appendChild(cell);
      });
      table.appendChild(row);
    }

    if (me.nickname && me.rank !== null && !entries.some((entry) => entry.me)) {
      table.appendChild(el('p', 'rank-note', `Você está em ${me.rank}º lugar.`, 'ranking-me-outside'));
    }
    return table;
  }

  hide(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.screen?.remove();
    this.screen = null;
  }
}
