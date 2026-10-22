// Content gate: every room's real question bank must validate, contain no
// personal data, and feed every mission of its room.
import { describe, expect, it } from 'vitest';
import { ROOMS } from '../../src/engine/content/rooms';
import { findPersonalDataPatterns, validateQuestionBank } from '../../src/engine/content/validateContent';
import { questionsForMode } from '../../src/engine/modes';

describe('content gate: the rooms of the hall', () => {
  it('has at least the Compliance and Banking rooms, with unique ids and door order', () => {
    const ids = ROOMS.map((room) => room.def.id);
    expect(ids).toEqual(expect.arrayContaining(['compliance', 'banking']));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ROOMS.map((room) => room.def.order)).size).toBe(ROOMS.length);
  });

  it.each(ROOMS.map((room) => [room.def.id, room] as const))('room %s: room.json is well formed', (_id, room) => {
    const { def } = room;
    expect(def.id).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(def.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    for (const text of [def.title, def.tagline, def.kicker, def.menuTitle, def.blurb, def.emptyNote]) {
      expect(text.trim()).not.toBe('');
    }
    expect(def.modes.length).toBeGreaterThan(0);
    const modeIds = def.modes.map((m) => m.id);
    expect(new Set(modeIds).size).toBe(modeIds.length);
    for (const mode of def.modes) {
      expect(mode.id, mode.id).toMatch(/^[a-z0-9-]{1,40}$/); // the backend refuses anything else
      if (mode.kind === 'category') expect(def.categories, mode.id).toContain(mode.category);
    }
  });

  it('mode ids never repeat between rooms (they are saved with every game)', () => {
    const all = ROOMS.flatMap((room) => room.def.modes.map((m) => m.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('question ids never repeat between rooms (progress is keyed by them)', () => {
    const all = ROOMS.flatMap((room) => room.questions.map((q) => q.sceneId));
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(ROOMS.map((room) => [room.def.id, room] as const))('room %s: the bank validates cleanly', (_id, room) => {
    expect(validateQuestionBank(room.questions, room.def.categories)).toEqual([]);
  });

  it.each(ROOMS.map((room) => [room.def.id, room] as const))('room %s: no personal-data pattern in any string', (_id, room) => {
    const offenders: string[] = [];
    for (const q of room.questions) {
      const strings = [
        q.question,
        q.topicTag,
        ...q.dialogue.flatMap((line) => [line.speaker, line.text]),
        ...q.choices.flatMap((choice) => [choice.text, choice.feedback]),
      ];
      for (const str of strings) {
        const found = findPersonalDataPatterns(str);
        if (found.length > 0) offenders.push(`${q.sceneId}: "${str}" matched ${found.join(',')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('content gate: the Compliance room', () => {
  const room = ROOMS.find((r) => r.def.id === 'compliance')!;

  it('is not empty', () => {
    expect(room.questions.length).toBeGreaterThan(0);
  });

  it('feeds every training mission and the 106-question exam', () => {
    for (const mode of room.def.modes) {
      if (mode.kind === 'wrong') continue; // depends on the player's history
      expect(questionsForMode(mode, room.questions).length, mode.id).toBeGreaterThan(0);
    }
    const exam = room.def.modes.find((m) => m.id === 'prova-abt1')!;
    expect(questionsForMode(exam, room.questions)).toHaveLength(106);
  });
});
