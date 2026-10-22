// "Reportar" journey: the form under the feedback, the store contract and the Reports sheet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogueOverlay } from '../../src/engine/ui/DialogueOverlay';
import { evaluateDecision } from '../../src/engine/systems/ScoringSystem';
import { AppsScriptGameStore } from '../../src/state/AppsScriptGameStore';
import { LocalGameStore } from '../../src/state/LocalGameStore';
import { REPORT_REASONS } from '../../src/state/reports';
import type { QuestionReport } from '../../src/state/reports';
import { makeFixtureScene } from '../fixtures/fixtureContent';

const scene = makeFixtureScene(1, { choiceCount: 3 });

describe('report form', () => {
  let root: HTMLElement;
  let overlay: DialogueOverlay;
  const submit = vi.fn();

  beforeEach(() => {
    submit.mockReset();
    submit.mockResolvedValue('saved');
    root = document.createElement('div');
    document.body.appendChild(root);
    overlay = new DialogueOverlay(root);
    overlay.showDecision(scene, () => {});
    overlay.showFeedback(scene, evaluateDecision(scene, 'b'), () => {}, submit);
  });
  afterEach(() => {
    overlay.unmount();
    root.remove();
  });

  const q = <T extends HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`);
  const openForm = () => q<HTMLButtonElement>('btn-report')!.click();
  const pick = (id: string) => root.querySelector<HTMLButtonElement>(`[data-reason-id="${id}"]`)!.click();

  it('has no button when nobody receives reports', () => {
    overlay.unmount();
    overlay.showDecision(scene, () => {});
    overlay.showFeedback(scene, evaluateDecision(scene, 'b'), () => {});
    expect(q('btn-report')).toBeNull();
  });

  it('lists every reason and keeps Send off until one is chosen', () => {
    openForm();
    expect(root.querySelectorAll('[data-testid="report-reason"]')).toHaveLength(REPORT_REASONS.length);
    expect(q<HTMLButtonElement>('report-send')!.disabled).toBe(true);
    pick('wrong-justification');
    expect(q<HTMLButtonElement>('report-send')!.disabled).toBe(false);
  });

  it('requires a comment for "other"', () => {
    openForm();
    pick('other');
    expect(q<HTMLButtonElement>('report-send')!.disabled).toBe(true);
    const comment = q<HTMLTextAreaElement>('report-comment')!;
    comment.value = 'Falta contexto';
    comment.dispatchEvent(new Event('input'));
    expect(q<HTMLButtonElement>('report-send')!.disabled).toBe(false);
  });

  it('sends reason and comment, then confirms', async () => {
    openForm();
    pick('wrong-answer');
    const comment = q<HTMLTextAreaElement>('report-comment')!;
    comment.value = '  A norma diz outra coisa  ';
    q<HTMLButtonElement>('report-send')!.click();
    await vi.waitFor(() => expect(q('report-panel')).toBeNull());
    expect(submit).toHaveBeenCalledWith({ reason: 'wrong-answer', comment: 'A norma diz outra coisa' });
    expect(q<HTMLButtonElement>('btn-report')!.disabled).toBe(true);
    expect(q('btn-report')!.textContent).toContain('enviado');
  });

  it('keeps the form open with a message when sending fails', async () => {
    submit.mockRejectedValue(new Error('offline'));
    openForm();
    pick('typo');
    q<HTMLButtonElement>('report-send')!.click();
    await vi.waitFor(() => expect(q('report-status')!.textContent).toContain('Não foi possível'));
    expect(q('report-panel')).not.toBeNull();
    expect(q<HTMLButtonElement>('report-send')!.disabled).toBe(false);
  });

  it('leaves Space and Enter alone while open, and Escape closes the form', () => {
    openForm();
    const space = new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
    window.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    const esc = new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(esc);
    expect(q('report-panel')).toBeNull();
  });
});

const report: QuestionReport = {
  id: '11111111-1111-4111-8111-111111111111',
  questionId: 'fixture-01',
  reason: 'wrong-answer',
  comment: '',
  chosenChoiceId: 'b',
  correctChoiceId: 'a',
  createdAt: '2026-01-01T10:00:00.000Z',
};

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('report stores', () => {
  it('cloud store sends the report to the script', async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true });
    const store = new AppsScriptGameStore(transport, memoryStorage());
    expect(await store.reportQuestion(report)).toBe('saved');
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ action: 'reportQuestion', report }));
  });

  it('cloud store queues when offline and retries on the next start', async () => {
    const storage = memoryStorage();
    const down = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await new AppsScriptGameStore(down, storage).reportQuestion(report)).toBe('queued');
    const up = vi.fn().mockResolvedValue({ ok: true });
    await new AppsScriptGameStore(up, storage).init();
    expect(up).toHaveBeenCalledWith(expect.objectContaining({ action: 'reportQuestion', report }));
  });

  it('local store keeps it in the browser', async () => {
    const storage = memoryStorage();
    expect(await new LocalGameStore(storage).reportQuestion(report)).toBe('queued');
    expect(JSON.parse(storage.getItem('cq.reports.v1')!)).toEqual([report]);
  });
});
