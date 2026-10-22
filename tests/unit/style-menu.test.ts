import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BankMenu } from '../../src/engine/ui/BankMenu';
import { HowItWorks } from '../../src/engine/ui/HowItWorks';
import { GAME_STYLES } from '../../src/engine/styles';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('BankMenu: the game-style step (between the mission and the quantity)', () => {
  let root: HTMLElement;
  let menu: BankMenu;
  const onPick = vi.fn();
  const onBack = vi.fn();
  const data = {
    modeTitle: 'Quem é quem no SFN',
    styles: GAME_STYLES.map(({ id, title, description }) => ({ id, title, description })),
  };

  beforeEach(() => {
    onPick.mockClear();
    onBack.mockClear();
    root = document.createElement('div');
    document.body.appendChild(root);
    menu = new BankMenu(root, document.createElement('canvas'));
    menu.showStyles(data, { onPick, onBack });
  });
  afterEach(() => {
    menu.destroy();
    root.remove();
  });

  it('lists the four styles plus Voltar, under the mission title, and describes each', () => {
    expect(root.querySelector('.bank-kicker')?.textContent).toBe('Modo de jogo');
    expect(root.querySelector('.bank-title')?.textContent).toBe('Quem é quem no SFN');
    expect([...root.querySelectorAll('.bank-item-label')].map((n) => n.textContent)).toEqual([
      'Desvie do obstáculo',
      'Contra o tempo',
      'Corrida',
      'Fuja dos ladrões',
      'Voltar',
    ]);
    expect(root.querySelector('[data-testid="menu-detail"]')?.textContent).toContain('colunas');

    root.querySelector('[data-testid="style-corrida"]')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(root.querySelector('[data-testid="menu-detail"]')?.textContent).toContain('pule e agache');
  });

  it('arrows and Enter pick a style, Esc and Voltar go back', () => {
    press('ArrowDown');
    press('Enter');
    expect(onPick).toHaveBeenCalledWith('tempo');

    press('Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
    (root.querySelector('[data-testid="menu-back"]') as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});

describe('HowItWorks per style', () => {
  let root: HTMLElement;
  afterEach(() => root.remove());

  const open = (style: 'obstaculos' | 'tempo' | 'corrida' | 'pacman') => {
    root = document.createElement('div');
    document.body.appendChild(root);
    void new HowItWorks(root).show({ lives: 3, barriers: 5, style });
    return root.querySelector('[data-testid="how-it-works"]')!.textContent ?? '';
  };

  it('Desvie do obstáculo talks about columns', () => {
    const text = open('obstaculos');
    expect(text).toContain('Antes de voar');
    expect(text).toContain('colunas');
  });

  it('Contra o tempo explains the timer that depends on the text, and has no flying or hearts to catch', () => {
    const text = open('tempo');
    expect(text).toContain('Antes de começar');
    expect(text).toContain('cronômetro');
    expect(text).toContain('Quanto maior o texto, mais tempo');
    expect(text).not.toContain('coluna');
  });

  it('Corrida explains jumping and ducking, with the keys and the button', () => {
    const text = open('corrida');
    expect(text).toContain('Antes de correr');
    expect(text).toContain('Pule os obstáculos baixos');
    expect(text).toContain('agache sob os altos');
    expect(text).toContain('Agachar');
    expect(text).toContain('a cada 5 obstáculos'.replace('a ', 'A '));
  });

  it('Fuja dos ladrões explains the maze, the striped thieves and a question every 3 coins', () => {
    root = document.createElement('div');
    document.body.appendChild(root);
    void new HowItWorks(root).show({ lives: 3, barriers: 3, style: 'pacman' });
    const text = root.querySelector('[data-testid="how-it-works"]')!.textContent ?? '';
    expect(text).toContain('Antes de fugir');
    expect(text).toContain('ladrões de roupa listrada');
    expect(text).toContain('A cada 3 moedas vem uma pergunta');
  });
});
