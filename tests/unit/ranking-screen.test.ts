import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingScreen } from '../../src/engine/ui/RankingScreen';
import type { Leaderboard } from '../../src/state/records';

const board = (overrides: Partial<Leaderboard> = {}): Leaderboard => ({
  available: true,
  entries: [
    { rank: 1, nickname: 'Caio', mastered: 120, xp: 900, games: 12, me: false },
    { rank: 2, nickname: 'Ana', mastered: 80, xp: 500, games: 7, me: true },
    { rank: 3, nickname: 'Bia', mastered: 40, xp: 300, games: 4, me: false },
    { rank: 4, nickname: 'Davi', mastered: 10, xp: 90, games: 1, me: false },
  ],
  me: { nickname: 'Ana', rank: 2 },
  ...overrides,
});

describe('RankingScreen', () => {
  let root: HTMLElement;
  let screen: RankingScreen;
  const onBack = vi.fn();
  const onSaveNickname = vi.fn<(nickname: string) => Promise<string | null>>();

  beforeEach(() => {
    onBack.mockClear();
    onSaveNickname.mockReset();
    root = document.createElement('div');
    document.body.appendChild(root);
    screen = new RankingScreen(root);
  });

  afterEach(() => {
    screen.hide();
    root.remove();
  });

  const rows = () => [...root.querySelectorAll('[data-testid="ranking-row"]')];
  const show = (data: Partial<Leaderboard> = {}) =>
    screen.show({ board: board(data), totalQuestions: 225 }, { onBack, onSaveNickname });

  it('lists players in order with mastered/total, XP and games, and marks you', () => {
    show();
    expect(rows()).toHaveLength(4);
    expect(rows()[0].textContent).toBe('1ºCaio120/22590012');
    expect(rows()[1].textContent).toContain('Ana (você)');
    expect(rows()[1].classList.contains('rank-row--me')).toBe(true);
    expect(rows()[0].classList.contains('rank-row--top')).toBe(true);
    expect(rows()[3].classList.contains('rank-row--top')).toBe(false);
  });

  it('never prints anything but the nickname for each person', () => {
    show();
    expect(root.textContent).not.toMatch(/@|[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('asks for a nickname when the player has none, and says where they stand when outside the top list', () => {
    show({ me: { nickname: null, rank: null } });
    expect(root.querySelector('[data-testid="nickname-save"]')?.textContent).toBe('Entrar no ranking');

    screen.hide();
    show({ entries: board().entries.map((e) => ({ ...e, me: false })), me: { nickname: 'Ana', rank: 57 } });
    expect(root.querySelector('[data-testid="ranking-me-outside"]')?.textContent).toBe('Você está em 57º lugar.');
    expect(root.querySelector('[data-testid="nickname-save"]')?.textContent).toBe('Salvar apelido');
  });

  it('sends the nickname and shows the problem the app reports', async () => {
    show({ me: { nickname: null, rank: null } });
    onSaveNickname.mockResolvedValueOnce('Esse apelido já está em uso. Escolha outro.');
    const input = root.querySelector<HTMLInputElement>('[data-testid="nickname-input"]')!;
    input.value = 'Ana';
    root.querySelector<HTMLFormElement>('[data-testid="nickname-form"]')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(onSaveNickname).toHaveBeenCalledWith('Ana');
    expect(root.querySelector('[data-testid="nickname-message"]')?.textContent).toBe('Esse apelido já está em uso. Escolha outro.');
    // A refusal must never look like a success: it gets the error color, not the accent.
    expect(root.querySelector('[data-testid="nickname-message"]')?.classList.contains('is-error')).toBe(true);
    expect((root.querySelector('[data-testid="nickname-save"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('explains an empty ranking and an offline game', () => {
    show({ entries: [], me: { nickname: null, rank: null } });
    expect(root.querySelector('[data-testid="ranking-empty"]')).not.toBeNull();

    screen.hide();
    show({ available: false, entries: [] });
    expect(root.querySelector('[data-testid="ranking-unavailable"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="nickname-form"]')).toBeNull();
  });

  it('shows the group bar only when the app can open groups, and points to a group when none is chosen', () => {
    show();
    expect(root.querySelector('[data-testid="ranking-groups"]')).toBeNull();

    screen.hide();
    const onGroups = vi.fn();
    screen.show({ board: board(), totalQuestions: 225, groupName: 'Equipe Azul' }, { onBack, onSaveNickname, onGroups });
    expect(root.querySelector('[data-testid="ranking-group"]')!.textContent).toBe('Grupo: Equipe Azul');
    (root.querySelector('[data-testid="ranking-groups"]') as HTMLButtonElement).click();
    expect(onGroups).toHaveBeenCalledOnce();

    screen.hide();
    screen.show({ board: board({ available: false, entries: [] }), totalQuestions: 225 }, { onBack, onSaveNickname, onGroups });
    expect(root.querySelector('[data-testid="ranking-group"]')!.textContent).toBe('Nenhum grupo escolhido');
    expect(root.querySelector('[data-testid="ranking-unavailable"]')!.textContent).toContain('grupo');
  });

  it('goes back with the button and with Escape, and stops listening after hide', () => {
    show();
    (root.querySelector('[data-testid="ranking-back"]') as HTMLButtonElement).click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onBack).toHaveBeenCalledTimes(2);

    screen.hide();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
