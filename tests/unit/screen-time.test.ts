import { describe, expect, it, vi } from 'vitest';
import { ScreenTimer, type ScreenTimeReport } from '../../src/engine/screenTime';

function setup(initialRoom: string | null = null) {
  let active = true;
  let room = initialRoom;
  const sent: ScreenTimeReport[] = [];
  const timer = new ScreenTimer({
    send: (report) => void sent.push(report),
    getRoom: () => room,
    isActive: () => active,
    sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  });
  return { timer, sent, setActive: (v: boolean) => (active = v), setRoom: (r: string | null) => (room = r) };
}

describe('ScreenTimer', () => {
  it('counts only active seconds, per room, outside rooms as hall', () => {
    const { timer, sent, setActive, setRoom } = setup();
    timer.tick();
    setRoom('compliance');
    timer.tick();
    timer.tick();
    setActive(false);
    timer.tick(); // idle / hidden tab: not counted
    timer.flush();
    expect(sent[0].seconds).toEqual({ hall: 1, compliance: 2 });
  });

  it('sends nothing when nothing changed and resends cumulative totals', () => {
    const { timer, sent } = setup('compliance');
    timer.flush();
    expect(sent.length).toBe(0);
    timer.tick();
    timer.flush();
    timer.flush();
    timer.tick();
    timer.flush();
    expect(sent.map((r) => r.seconds.compliance)).toEqual([1, 2]);
  });

  it('retries on the next flush when sending fails', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const timer = new ScreenTimer({ send, getRoom: () => null, isActive: () => true });
    timer.tick();
    timer.flush();
    await Promise.resolve();
    await Promise.resolve();
    timer.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
