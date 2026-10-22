// Game styles: the second choice in the menu, after the topic. Every style uses the
// same questions, lives, last chance, heart, XP, mastery and Hall da Fama; only the
// action between the questions changes. Titles are menu copy (UI), not question content.
export type GameStyle = 'obstaculos' | 'tempo' | 'corrida' | 'pacman';

export interface GameStyleInfo {
  id: GameStyle;
  title: string;
  description: string;
  sceneKey: 'FlappyScene' | 'TimeAttackScene' | 'RunnerScene' | 'PacmanScene';
}

export const GAME_STYLES: readonly GameStyleInfo[] = [
  {
    id: 'obstaculos',
    title: 'Desvie do obstáculo',
    description: 'Voe entre as colunas. A cada 5 colunas, uma pergunta.',
    sceneKey: 'FlappyScene',
  },
  {
    id: 'tempo',
    title: 'Contra o tempo',
    description: 'Perguntas seguidas e um cronômetro. O tempo depende do tamanho da pergunta.',
    sceneKey: 'TimeAttackScene',
  },
  {
    id: 'corrida',
    title: 'Corrida',
    description: 'Corra, pule e agache. A cada 5 obstáculos, uma pergunta.',
    sceneKey: 'RunnerScene',
  },
  {
    id: 'pacman',
    title: 'Fuja dos ladrões',
    description: 'Labirinto: pegue as moedas e fuja dos ladrões de listras. A cada 3 moedas, uma pergunta.',
    sceneKey: 'PacmanScene',
  },
];

export const DEFAULT_STYLE: GameStyle = 'obstaculos';

export function getStyle(id: string | undefined): GameStyleInfo {
  return GAME_STYLES.find((style) => style.id === id) ?? GAME_STYLES[0];
}

export function isGameStyle(value: unknown): value is GameStyle {
  return GAME_STYLES.some((style) => style.id === value);
}

export const ALL_SCENE_KEYS = GAME_STYLES.map((style) => style.sceneKey);
