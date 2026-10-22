// DOM screen outside the run: the player's profile/history in one room (the game
// modes and size picker live in the room scene, see BankMenu). createElement/textContent only (never markup strings),
// same XSS-safety convention as the other overlays. All data (counts, games)
// is passed in; the controller in src/app decides what happens on each click.
import './menu.css';
import './pixel.css';
import { pixelBar } from './pixelBar';
import type { GameSummary, PlayerStats, RunResult } from '../../state/records';

export interface ProfileProgress {
  pct: number;
  stageName: string;
  mastered: number;
  total: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  goal: string;
  topics: { title: string; mastered: number; total: number }[];
}

export interface ProfileData {
  roomTitle?: string; // the profile shows the progress of this room
  stats: PlayerStats;
  progress?: ProfileProgress;
  wrongCount: number;
  games: GameSummary[];
  modeTitle(modeId: string): string;
  styleTitle?(style: string | undefined): string;
  storageKind: 'local' | 'cloud';
  loadError?: string;
}

export interface ProfileHandlers {
  onBack(): void;
}

const RESULT_LABEL: Record<RunResult, string> = {
  completed: 'Concluída',
  gameover: 'Fim das vidas',
  abandoned: 'Abandonada',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (testId) node.dataset.testid = testId;
  return node;
}

function button(label: string, testId: string, onClick: () => void, secondary = false): HTMLButtonElement {
  const b = el('button', secondary ? 'menu-btn menu-btn--secondary' : 'menu-btn', label, testId);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export class MenuUi {
  private screen: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {}

  private mount(testId: string): HTMLElement {
    this.hide();
    const screen = el('section', 'menu-screen', undefined, testId);
    const content = el('div', 'menu-content');
    screen.appendChild(content);
    this.root.appendChild(screen);
    this.screen = screen;
    return content;
  }

  hide(): void {
    this.screen?.remove();
    this.screen = null;
  }

  showProfile(data: ProfileData, handlers: ProfileHandlers): void {
    const content = this.mount('menu-profile-screen');
    content.appendChild(el('p', 'menu-kicker', data.roomTitle ? `Perfil · ${data.roomTitle}` : 'Perfil'));
    content.appendChild(el('h1', 'menu-title', 'Meu crachá'));

    if (data.progress) content.appendChild(this.buildProgress(data.progress));

    const stats = el('div', 'menu-stats');
    const stat = (value: string, label: string, testId: string): void => {
      const box = el('div', 'menu-stat');
      box.appendChild(el('span', 'menu-stat-value', value, testId));
      box.appendChild(el('span', 'menu-stat-label', label));
      stats.appendChild(box);
    };
    stat(String(data.stats.gamesPlayed), 'missões', 'stat-games');
    stat(`${data.stats.totalXp}`, 'XP acumulado', 'stat-xp');
    stat(String(data.wrongCount), 'questões para revisar', 'stat-wrong');
    content.appendChild(stats);

    if (data.loadError) content.appendChild(el('p', 'menu-notice', data.loadError));

    content.appendChild(el('h2', 'menu-subtitle', 'Minhas missões'));
    if (data.games.length === 0) {
      content.appendChild(el('p', 'menu-lead', 'Você ainda não jogou. Escolha um modo e comece!', 'games-empty'));
    } else {
      const list = el('div', 'menu-games', undefined, 'games-list');
      for (const game of data.games) {
        const row = el('div', 'menu-game', undefined, 'game-row');
        const when = new Date(game.startedAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        row.appendChild(el('span', 'menu-game-mode', data.modeTitle(game.modeId)));
        row.appendChild(
          el(
            'span',
            'menu-game-meta',
            `${when} · ${data.styleTitle ? data.styleTitle(game.style) + ' · ' : ''}${game.correctCount}/${game.answeredCount} acertos · ${RESULT_LABEL[game.result]}`,
          ),
        );
        row.appendChild(el('span', 'menu-game-xp', `${game.xp} XP`));
        list.appendChild(row);
      }
      content.appendChild(list);
    }

    content.appendChild(this.buildAccount(data));

    const footer = el('div', 'menu-footer');
    footer.appendChild(button('Voltar à sala', 'menu-back', handlers.onBack, true));
    content.appendChild(footer);
  }

  private buildProgress(progress: ProfileProgress): HTMLElement {
    const box = el('div', 'menu-progress px-box', undefined, 'profile-progress');
    const head = el('div', 'menu-progress-head');
    head.appendChild(el('span', 'menu-progress-pct', `${progress.pct}%`, 'profile-pct'));
    head.appendChild(el('span', 'px-tag', progress.stageName));
    box.appendChild(head);
    box.appendChild(pixelBar(progress.pct / 100, 24));
    box.appendChild(
      el('p', 'menu-hint', `${progress.mastered} de ${progress.total} questões dominadas. ${progress.goal}`),
    );
    box.appendChild(
      el(
        'p',
        'menu-hint',
        `Nível ${progress.level} · ${progress.xpIntoLevel} de ${progress.xpForNext} XP para o próximo`,
        'profile-level',
      ),
    );

    const topics = el('div', 'menu-topics', undefined, 'profile-topics');
    for (const topic of progress.topics) {
      const row = el('div', 'menu-topic');
      row.appendChild(el('span', undefined, topic.title));
      row.appendChild(el('span', 'menu-topic-count', `${topic.mastered}/${topic.total}`));
      row.appendChild(pixelBar(topic.total === 0 ? 0 : topic.mastered / topic.total, 24, 'px-bar--thin'));
      topics.appendChild(row);
    }
    box.appendChild(topics);
    return box;
  }

  private buildAccount(data: ProfileData): HTMLElement {
    const box = el('div', 'menu-account');
    box.appendChild(el('h2', 'menu-subtitle', 'Privacidade'));
    box.appendChild(
      el(
        'p',
        'menu-hint',
        data.storageKind === 'cloud'
          ? 'Guardamos apenas o que você joga (modo, acertos, XP e quais questões errou), ligado a um código que não é o seu e-mail. Não usamos dados de clientes. Os colegas só veem algo seu no ranking se você escolher um apelido lá.'
          : 'Seus jogos e erros ficam salvos só neste navegador. Se você limpar os dados do navegador, eles se perdem.',
      ),
    );
    return box;
  }
}
