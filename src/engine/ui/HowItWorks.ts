// Brief, skippable "how it works" card shown before every run: lives, what a
// wrong answer costs, the last-chance question and the heart. Resolves when the
// player taps a button or presses Enter/Space/Escape. DOM-only (createElement /
// textContent). Numbers come from the caller, so the card never disagrees with
// the rules in config.
import './how-it-works.css';
import './pixel.css';
import { DEFAULT_STYLE } from '../styles';
import type { GameStyle } from '../styles';

export interface HowItWorksRules {
  lives: number;
  barriers: number; // barriers (or obstacles) between questions
  style?: GameStyle;
}

function rulesFor(rules: HowItWorksRules): [string, string][] {
  const style = rules.style ?? DEFAULT_STYLE;
  if (style === 'tempo') {
    return [
      ['♥', `Você começa com ${rules.lives} vidas. Errar uma pergunta, ou deixar o tempo acabar, custa 1.`],
      ['⏱', 'Cada pergunta tem um cronômetro. Quanto maior o texto, mais tempo você tem.'],
      ['?', 'Acertar dá XP e combo. Na última vida, errar encerra a partida.'],
      ['♥', 'Depois da metade, um acerto pode devolver 1 vida (só uma vez por jogo).'],
    ];
  }
  if (style === 'corrida') {
    return [
      ['♥', `Você começa com ${rules.lives} vidas. Bater num obstáculo custa 1.`],
      ['↕', 'Pule os obstáculos baixos (Espaço, ↑ ou toque) e agache sob os altos (↓ ou botão Agachar).'],
      ['?', `A cada ${rules.barriers} obstáculos vem uma pergunta. Errar custa 1 vida; acertar dá XP e deixa a corrida mais rápida.`],
      ['!', 'Bateu na última vida? Vem uma pergunta de última chance: acertou, continua; errou, acabou.'],
      ['♥', 'No meio da fase pode aparecer um coração no alto: pule para pegar (só um por jogo).'],
    ];
  }
  if (style === 'pacman') {
    return [
      ['♥', `Você começa com ${rules.lives} vidas. Ser pego por um ladrão custa 1.`],
      ['◉', 'Ande pelo labirinto com as setas, WASD ou deslizando o dedo. Fuja dos ladrões de roupa listrada e pegue as moedas.'],
      ['?', `A cada ${rules.barriers} moedas vem uma pergunta. Errar custa 1 vida; acertar dá XP e deixa os ladrões mais rápidos.`],
      ['!', 'Pego na última vida? Vem uma pergunta de última chance: acertou, continua; errou, acabou.'],
      ['♥', 'No meio da fase pode aparecer um coração no labirinto: devolve 1 vida (só um por jogo).'],
    ];
  }
  return [
    ['♥', `Você começa com ${rules.lives} vidas. Bater numa coluna custa 1.`],
    ['?', `A cada ${rules.barriers} colunas vem uma pergunta. Errar custa 1 vida; acertar dá XP e deixa o jogo mais rápido.`],
    ['!', 'Bateu na última vida? Vem uma pergunta de última chance: acertou, continua; errou, acabou.'],
    ['♥', 'No meio da fase pode aparecer um coração: devolve 1 vida (só um por jogo).'],
  ];
}

export class HowItWorks {
  private section: HTMLElement | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly root: HTMLElement) {}

  show(rules: HowItWorksRules): Promise<void> {
    this.close();
    return new Promise((resolve) => {
      const section = document.createElement('section');
      section.className = 'hiw';
      section.dataset.testid = 'how-it-works';

      const card = document.createElement('div');
      card.className = 'hiw-card px-box px-box--lime';

      const kicker = document.createElement('p');
      kicker.className = 'hiw-kicker';
      kicker.textContent = 'Como funciona';
      card.appendChild(kicker);

      const title = document.createElement('h2');
      title.className = 'hiw-title';
      title.textContent = { obstaculos: 'Antes de voar', tempo: 'Antes de começar', corrida: 'Antes de correr', pacman: 'Antes de fugir' }[
        rules.style ?? DEFAULT_STYLE
      ];
      card.appendChild(title);

      const list = document.createElement('ul');
      list.className = 'hiw-list';
      const rows = rulesFor(rules);
      for (const [glyph, text] of rows) {
        const item = document.createElement('li');
        const mark = document.createElement('span');
        mark.className = 'hiw-glyph';
        mark.textContent = glyph;
        const copy = document.createElement('span');
        copy.textContent = text;
        item.append(mark, copy);
        list.appendChild(item);
      }
      card.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'hiw-actions';
      const finish = (): void => {
        this.close();
        resolve();
      };
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'hiw-btn hiw-btn--ghost';
      skip.dataset.testid = 'hiw-skip';
      skip.textContent = 'Pular';
      skip.addEventListener('click', finish);
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'hiw-btn';
      go.dataset.testid = 'hiw-go';
      go.textContent = 'Entendi';
      go.addEventListener('click', finish);
      actions.append(skip, go);
      card.appendChild(actions);

      section.appendChild(card);
      this.root.appendChild(section);
      this.section = section;
      go.focus();

      this.keyHandler = (event: KeyboardEvent) => {
        if (event.repeat) return;
        if (['Enter', 'Space', 'Escape', 'NumpadEnter'].includes(event.code)) {
          event.preventDefault();
          event.stopPropagation();
          finish();
        }
      };
      // Capture phase: the game's own flap keys must not see this key press.
      window.addEventListener('keydown', this.keyHandler, true);
    });
  }

  private close(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
    this.section?.remove();
    this.section = null;
  }
}
