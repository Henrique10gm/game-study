import { BRAND, BRAND_SPOKEN } from '../../src/brand';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BankMenu } from '../../src/engine/ui/BankMenu';
import type { HomeData } from '../../src/engine/ui/BankMenu';

const home: HomeData = {
  room: { title: 'Sala de Teste', kicker: 'Missões de teste', menuTitle: 'Escolha a missão' },
  storageKind: 'local',
  modes: [
    { id: 'a', title: 'Modo A', description: 'Descrição A', count: 10 },
    { id: 'b', title: 'Modo B', description: 'Descrição B', count: 20 },
    { id: 'c', title: 'Modo C', description: 'Descrição C', count: 0, disabledReason: 'Sem questões ainda' },
  ],
};

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('BankMenu', () => {
  let root: HTMLElement;
  let menu: BankMenu;
  const onPick = vi.fn();
  const onProfile = vi.fn();
  const onRanking = vi.fn();
  const onHallBack = vi.fn();

  beforeEach(() => {
    onPick.mockClear();
    onProfile.mockClear();
    onRanking.mockClear();
    onHallBack.mockClear();
    root = document.createElement('div');
    document.body.appendChild(root);
    menu = new BankMenu(root, document.createElement('canvas'));
    menu.showModes(home, { onPick, onProfile, onRanking, onBack: onHallBack });
  });

  afterEach(() => {
    menu.destroy();
    root.remove();
  });

  const detail = () => root.querySelector('[data-testid="menu-detail"]')?.textContent;
  const active = () => root.querySelector('.bank-item.is-active .bank-item-label')?.textContent;

  it('stacks the modes and the profile entry, describing the first one', () => {
    const labels = [...root.querySelectorAll('.bank-item-label')].map((b) => b.textContent);
    expect(labels).toEqual(['Modo A', 'Modo B', 'Modo C', 'Meu crachá', 'Voltar à casa']);
    expect(detail()).toBe('Descrição A (10 questões)');
  });

  it('spells the wordmark with the two parts of the brand', () => {
    const logo = root.querySelector('.bank-logo')!;
    expect(logo.getAttribute('aria-label')).toBe(BRAND_SPOKEN);
    expect(logo.textContent).toBe(BRAND.light + BRAND.bold);
  });

  it('hover shows what each mode is', () => {
    root.querySelector('[data-testid="mode-b"]')?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(active()).toBe('Modo B');
    expect(detail()).toBe('Descrição B (20 questões)');
  });

  it('arrow keys move through the entries (wrapping) and Enter picks the active one', () => {
    press('ArrowDown');
    expect(active()).toBe('Modo B');
    press('Enter');
    expect(onPick).toHaveBeenCalledWith('b');

    press('ArrowUp');
    press('ArrowUp'); // wraps to the last entry, "Voltar à casa"
    expect(active()).toBe('Voltar à casa');
    press('ArrowUp');
    expect(active()).toBe('Meu crachá');
    press('Enter');
    expect(onProfile).toHaveBeenCalled();
  });

  const hall = {
    available: true,
    entries: [
      { rank: 1, nickname: 'Caio', mastered: 120, me: false },
      { rank: 2, nickname: 'Bia', mastered: 80, me: false },
      { rank: 3, nickname: 'Henrique', mastered: 40, me: true },
    ],
    me: { nickname: 'Henrique', rank: 3 },
    total: 12,
  };

  it('shows the Hall da Fama on the left of the menu, without having to open anything', () => {
    menu.showModes({ ...home, hall }, { onPick, onProfile, onRanking, onBack: onHallBack });
    const rows = [...root.querySelectorAll('[data-testid="hall-row"]')].map((r) => r.textContent);
    expect(rows).toEqual(['1ºCaio120', '2ºBia80', '3ºHenrique (você)40']);
    expect(root.querySelectorAll('.bank-hall-row.is-me')).toHaveLength(1);

    (root.querySelector('[data-testid="hall-open"]') as HTMLButtonElement).click();
    expect(onRanking).toHaveBeenCalledTimes(1);
  });

  it('the Hall da Fama card says where you stand when you are outside the top, or invites a nickname', () => {
    menu.showModes(
      { ...home, hall: { ...hall, entries: hall.entries.map((e) => ({ ...e, me: false })), me: { nickname: 'Henrique', rank: 9 } } },
      { onPick, onProfile, onRanking, onBack: onHallBack },
    );
    expect(root.querySelector('[data-testid="hall-me"]')?.textContent).toBe('Você: 9º');

    menu.showModes({ ...home, hall: { ...hall, me: { nickname: null, rank: 4 } } }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="hall-join"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hall-open"]')?.textContent).toBe('Escolher apelido');
  });

  it('the Hall da Fama card says so when you are the only one, and keeps your row in the list', () => {
    const alone = { rank: 1, nickname: 'Henrique', mastered: 3, me: true };
    menu.showModes({ ...home, hall: { ...hall, entries: [alone], me: { nickname: 'Henrique', rank: 1 }, total: 1 } }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="hall-alone"]')).not.toBeNull();
    expect(root.querySelectorAll('.bank-hall-row.is-me')).toHaveLength(1);
  });

  it('shows your own row, marked as having no nickname, when you are not listed', () => {
    const ghost = { rank: 1, nickname: '', mastered: 5, me: true, ghost: true };
    menu.showModes({ ...home, hall: { ...hall, entries: [ghost], me: { nickname: null, rank: 1 }, total: 1 } }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="hall-row"]')?.textContent).toBe('1ºVocê (sem apelido)5');
    expect(root.querySelector('[data-testid="hall-join"]')).not.toBeNull();
  });

  it('shows the Hall as loading, then swaps in the list when it arrives', () => {
    menu.showModes({ ...home, hall: { ...hall, entries: [], status: 'loading' } }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="hall-loading"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hall-join"]')).toBeNull();
    menu.setHall(hall);
    expect(root.querySelector('[data-testid="hall-loading"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid="hall-row"]')).toHaveLength(3);
    menu.setHall({ ...hall, entries: [], status: 'error' });
    expect(root.querySelector('[data-testid="hall-error"]')).not.toBeNull();
  });

  it('the Hall da Fama card explains an empty list and a game without server', () => {
    menu.showModes({ ...home, hall: { ...hall, entries: [] } }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="hall-empty"]')).not.toBeNull();
    menu.showModes({ ...home, hall: { available: false, entries: [], me: { nickname: null, rank: null }, total: 0 } }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="hall-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="hall-open"]')).toBeNull();
  });

  it('on a small screen the menu becomes a scrolling column instead of a scaled stage', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ width: 375, height: 250, left: 0, top: 200, right: 375, bottom: 450, x: 0, y: 200, toJSON() {} });
    const small = new BankMenu(root, canvas);
    small.showModes(home, { onPick, onProfile, onRanking, onBack: onHallBack });
    const stages = root.querySelectorAll('.bank-stage');
    expect(stages[stages.length - 1].classList.contains('bank-stage--compact')).toBe(true);
    expect((stages[stages.length - 1] as HTMLElement).style.transform).toBe('none');
    small.destroy();
  });

  it('shows how much of each mode is already mastered', () => {
    menu.showModes(
      { ...home, modes: [{ ...home.modes[0], mastered: 4 }, home.modes[1]] },
      { onPick, onProfile, onRanking, onBack: onHallBack },
    );
    const row = root.querySelector('[data-testid="mode-a"]')!;
    expect(row.querySelector('.bank-item-meta')?.textContent).toBe('4/10');
    expect(row.querySelectorAll('.px-bar > span.on')).toHaveLength(10); // 40% of 24 segments
    expect(root.querySelector('[data-testid="mode-b"] .bank-item-meta')).toBeNull();
  });

  it('shows the readiness card with stage, counts and level, also on the size list', () => {
    const readiness = {
      pct: 34,
      stageName: 'Pegando o jeito',
      ready: false,
      mastered: 76,
      total: 225,
      examMastered: 12,
      examTotal: 45,
      level: 3,
      xpIntoLevel: 40,
      xpForNext: 200,
    };
    menu.showModes({ ...home, readiness }, { onPick, onProfile, onRanking, onBack: onHallBack });
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent;
    expect(text('readiness-pct')).toBe('34%');
    expect(text('readiness-stage')).toBe('Pegando o jeito');
    expect(text('readiness-mastered')).toBe('76 de 225 questões dominadas');
    expect(root.querySelector('[data-testid="readiness-goal"]')).toBeNull(); // no "faltam N questões" line on the menu
    expect(text('level-label')).toBe('Nível 3');

    menu.showSizes({ modeTitle: 'Modo A', options: [] }, { onPick: vi.fn(), onBack: vi.fn() }, readiness);
    expect(root.querySelector('[data-testid="readiness-card"]')).not.toBeNull();
    menu.hide();
    expect(root.querySelector('[data-testid="readiness-card"]')).toBeNull();
  });

  it('a mode without questions explains why and cannot be picked', () => {
    press('ArrowDown');
    press('ArrowDown');
    expect(detail()).toBe('Sem questões ainda');
    press('Enter');
    (root.querySelector('[data-testid="mode-c"]') as HTMLButtonElement).click();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('the size list picks an option, and Escape or "Voltar" goes back', () => {
    const onSize = vi.fn();
    const onBack = vi.fn();
    menu.showSizes(
      {
        modeTitle: 'Modo A',
        options: [
          { label: 'Fase completa (10 questões)', count: 10, complete: true },
          { label: '5 questões', count: 5, complete: false },
        ],
      },
      { onPick: onSize, onBack },
    );
    expect(root.querySelector('.bank-title')?.textContent).toBe('Modo A');

    press('ArrowDown');
    press('Enter');
    expect(onSize).toHaveBeenCalledWith({ label: '5 questões', count: 5, complete: false });

    press('Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
    (root.querySelector('[data-testid="menu-back"]') as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('takes the kicker and title from the room, and offers the way back to the hall', () => {
    expect(root.querySelector('.bank-kicker')?.textContent).toBe('Missões de teste');
    expect(root.querySelector('.bank-title')?.textContent).toBe('Escolha a missão');
    (root.querySelector('[data-testid="menu-hall-back"]') as HTMLButtonElement).click();
    expect(onHallBack).toHaveBeenCalledTimes(1);
    press('Escape');
    expect(onHallBack).toHaveBeenCalledTimes(2);
  });

  it('shows the exam line only for a room that has an exam', () => {
    const readiness = {
      pct: 10, stageName: 'Primeiro dia', ready: false, mastered: 2, total: 20,
      examMastered: 0, examTotal: 0, level: 1, xpIntoLevel: 0, xpForNext: 100,
    };
    menu.showModes({ ...home, readiness }, { onPick, onProfile, onRanking, onBack: onHallBack });
    expect(root.querySelector('[data-testid="readiness-card"]')?.textContent).not.toContain('Prova');
    menu.showModes(
      { ...home, readiness: { ...readiness, examLabel: 'Prova de teste', examMastered: 3, examTotal: 9 } },
      { onPick, onProfile, onRanking, onBack: onHallBack },
    );
    expect(root.querySelector('[data-testid="readiness-card"]')?.textContent).toContain('Prova de teste: 3 de 9');
  });

  it('shows only the corner pieces (no mission list) for the hall', () => {
    menu.showChrome();
    expect(root.querySelector('.bank-panel')).toBeNull();
    expect(root.querySelector('.bank-logo')).not.toBeNull();
  });

  it('ignores the keyboard while hidden', () => {
    menu.hide();
    press('Enter');
    expect(onPick).not.toHaveBeenCalled();
  });
});
