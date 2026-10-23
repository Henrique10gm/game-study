import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readFocusRoom, saveFocusRoom } from '../../src/state/certFocus';
import { applyBrand } from '../../src/brandHtml';
import { BRAND, BRAND_SPOKEN, brandKicker } from '../../src/brand';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('the chosen certification (focus room)', () => {
  it('remembers a valid room id and reads it back', () => {
    const storage = memory();
    expect(readFocusRoom(storage)).toBeNull();
    expect(saveFocusRoom(storage, 'compliance')).toBe(true);
    expect(readFocusRoom(storage)).toBe('compliance');
  });

  it('never stores or returns anything that is not a plain room id', () => {
    const storage = memory();
    for (const bad of ['', 'Compliance', 'a b', '<script>', 'x'.repeat(41), '../etc']) {
      expect(saveFocusRoom(storage, bad), bad).toBe(false);
    }
    expect(readFocusRoom(storage)).toBeNull();
    expect(readFocusRoom(memory({ 'qh.focusRoom.v1': '<b>' }))).toBeNull();
  });

  it('survives a browser without storage', () => {
    expect(readFocusRoom(null)).toBeNull();
    expect(saveFocusRoom(null, 'compliance')).toBe(true);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readFocusRoom(blocked)).toBeNull();
    expect(saveFocusRoom(blocked, 'compliance')).toBe(false);
  });
});

describe('brand', () => {
  it('fills every mark of an html page from src/brand.ts', () => {
    const html = '<title>{{BRAND_NAME}} · {{BRAND_TAGLINE}}</title><b>{{BRAND_LIGHT}}{{BRAND_BOLD}}</b>{{BRAND_SPOKEN}}{{BRAND_PLACE}}{{BRAND_DESCRIPTION}}';
    const out = applyBrand(html);
    expect(out).not.toContain('{{');
    expect(out).toContain(BRAND.name);
    expect(out).toContain(BRAND_SPOKEN);
  });

  it('the wordmark parts spell the name, and the caps line carries it', () => {
    expect((BRAND.light + BRAND.bold).toLowerCase()).toBe(BRAND.name.split(' ').join('').toLowerCase());
    expect(brandKicker()).toBe((BRAND.name + ' · ' + BRAND.place).toUpperCase());
    expect(brandKicker('Treinamento')).toContain('TREINAMENTO');
  });

  it('every {{BRAND_*}} mark used in index.html is one the plugin knows', () => {
    const html = readFileSync('index.html', 'utf8');
    const used = new Set(html.match(/\{\{BRAND_[A-Z]+\}\}/g) ?? []);
    expect(used.size).toBeGreaterThan(3);
    expect(applyBrand([...used].join(' '))).not.toContain('{{');
  });
});
