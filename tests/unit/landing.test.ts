import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENE } from '../../src/engine/palette';
import { drawSky, drawStreet, seededRandom, STREET, STREET_SEED } from '../../src/engine/scenes/street';
import type { Brush } from '../../src/engine/scenes/street';
import { GAME_STYLES } from '../../src/engine/styles';
import { applyBrand } from '../../src/brandHtml';
import { BRAND } from '../../src/brand';
import { canvasBrush } from '../../src/landing/canvasBrush';
import { CERTIFICATIONS } from '../../src/landing/certifications';
import { readFocusRoom } from '../../src/state/certFocus';
import { shouldSkipLanding } from '../../src/landing/entry';
import { initLanding } from '../../src/landing/landing';
import { AT_DOOR, atDoor, cameraShift, clamp01, heroX, HERO_START_X, sectionProgress, WALK_END, WALK_START } from '../../src/landing/scroll';

const where = (search = '', hash = '') => ({ search, hash });

describe('shouldSkipLanding', () => {
  it('shows the landing to an ordinary visitor, with or without an invite', () => {
    expect(shouldSkipLanding(where())).toBe(false);
    expect(shouldSkipLanding(where('?convite=abc123def456ghi789'))).toBe(false);
    expect(shouldSkipLanding(where('', '#produto'))).toBe(false);
  });

  it('goes straight to the game when the address answers a sign-in step', () => {
    expect(shouldSkipLanding(where('', '#access_token=x&refresh_token=y&type=signup'))).toBe(true);
    expect(shouldSkipLanding(where('', '#type=recovery&access_token=x'))).toBe(true);
    expect(shouldSkipLanding(where('?code=abc'))).toBe(true);
    expect(shouldSkipLanding(where('', '#error=access_denied&error_code=otp_expired'))).toBe(true);
    expect(shouldSkipLanding(where('?jogar'))).toBe(true);
  });

  it('the first-paint script in public/theme-init.js follows the same rule', () => {
    const script = readFileSync('public/theme-init.js', 'utf8');
    const urls = [
      '/',
      '/?convite=abc',
      '/#produto',
      '/#access_token=x&type=signup',
      '/#type=recovery',
      '/?code=abc',
      '/#error_description=x',
      '/?jogar',
    ];
    for (const url of urls) {
      window.history.replaceState(null, '', url);
      document.documentElement.classList.add('is-landing');
      new Function(script)();
      const skipped = !document.documentElement.classList.contains('is-landing');
      expect(skipped, url).toBe(shouldSkipLanding(window.location));
    }
    window.history.replaceState(null, '', '/');
  });
});

describe('walk to the door (scroll math)', () => {
  it('progress goes from 0 to 1 over the travel of the section', () => {
    expect(sectionProgress(1000, 1000, 3200, 800)).toBe(0);
    expect(sectionProgress(2200, 1000, 3200, 800)).toBe(0.5);
    expect(sectionProgress(3400, 1000, 3200, 800)).toBe(1);
    expect(sectionProgress(5000, 1000, 3200, 800)).toBe(1);
    expect(sectionProgress(0, 1000, 3200, 800)).toBe(0);
    expect(sectionProgress(10, 0, 500, 800)).toBe(1); // a section shorter than the screen is "done"
  });

  it('the hero waits, walks at an even pace, then stands at the bank door', () => {
    expect(heroX(0)).toBe(HERO_START_X);
    expect(heroX(WALK_START)).toBe(HERO_START_X);
    expect(heroX(WALK_END)).toBe(STREET.doorX);
    expect(heroX(1)).toBe(STREET.doorX);
    const steps = [0.2, 0.3, 0.4, 0.5, 0.6].map(heroX);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(steps[1] - steps[0]).toBeCloseTo(steps[3] - steps[2], 5);
  });

  it('the "Entrar" prompt appears only once the hero has arrived', () => {
    expect(atDoor(AT_DOOR - 0.01)).toBe(false);
    expect(atDoor(AT_DOOR)).toBe(true);
    expect(AT_DOOR).toBeGreaterThanOrEqual(WALK_END);
  });

  it('the camera follows the hero on a stage wider than the screen and never shows past the edges', () => {
    expect(cameraShift(100, 960, 1200)).toBe(0); // the whole stage fits
    const stage = 960;
    const screen = 390;
    const limit = (stage - screen) / 2;
    expect(cameraShift(0, stage, screen)).toBe(limit);
    expect(cameraShift(stage, stage, screen)).toBe(-limit);
    expect(cameraShift(stage / 2, stage, screen)).toBe(0);
  });

  it('clamp01 keeps numbers in range', () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(7)]).toEqual([0, 0.4, 1]);
  });
});

// A brush that only writes down what it was asked to paint.
function recorder(): { brush: Brush; calls: string[] } {
  const calls: string[] = [];
  const brush: Brush = {
    fillStyle: (color, alpha = 1) => (calls.push(`style ${color.toString(16)} ${alpha}`), brush),
    fillRect: (x, y, w, h) => (calls.push(`rect ${x} ${y} ${w} ${h}`), brush),
    fillTriangle: (...p) => (calls.push(`tri ${p.join(' ')}`), brush),
    fillCircle: (x, y, r) => (calls.push(`circle ${x} ${y} ${r}`), brush),
    lineStyle: (w, color) => (calls.push(`line ${w} ${color.toString(16)}`), brush),
    strokeRect: (x, y, w, h) => (calls.push(`stroke ${x} ${y} ${w} ${h}`), brush),
  };
  return { brush, calls };
}

describe('the street (shared by the game and the landing page)', () => {
  it('draws exactly the same picture every time, so the landing matches the game', () => {
    const first = recorder();
    const second = recorder();
    drawStreet(first.brush, SCENE.night, seededRandom(STREET_SEED));
    drawStreet(second.brush, SCENE.night, seededRandom(STREET_SEED));
    expect(first.calls.length).toBeGreaterThan(100);
    expect(second.calls).toEqual(first.calls);
  });

  it('day and night use different colors but the same shapes of bank and street', () => {
    const night = recorder();
    const day = recorder();
    drawStreet(night.brush, SCENE.night, seededRandom(STREET_SEED));
    drawStreet(day.brush, SCENE.day, seededRandom(STREET_SEED));
    expect(day.calls).not.toEqual(night.calls);
    const bank = (calls: string[]) => calls.filter((c) => c.startsWith('tri') || c.startsWith('stroke'));
    expect(bank(day.calls)).toEqual(bank(night.calls));
  });

  it('the sky alone is a prefix of the whole street (the landing hero uses only the sky)', () => {
    const whole = recorder();
    const sky = recorder();
    drawStreet(whole.brush, SCENE.day, seededRandom(STREET_SEED));
    drawSky(sky.brush, SCENE.day, seededRandom(STREET_SEED));
    expect(whole.calls.slice(0, sky.calls.length)).toEqual(sky.calls);
  });
});

describe('canvasBrush', () => {
  function fakeContext() {
    const log: string[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect: (...a: number[]) => log.push(`fillRect ${a.join(' ')} ${ctx.fillStyle}`),
      strokeRect: (...a: number[]) => log.push(`strokeRect ${a.join(' ')} ${ctx.strokeStyle} ${ctx.lineWidth}`),
      beginPath: () => log.push('begin'),
      moveTo: (...a: number[]) => log.push(`move ${a.join(' ')}`),
      lineTo: (...a: number[]) => log.push(`line ${a.join(' ')}`),
      closePath: () => log.push('close'),
      arc: (...a: number[]) => log.push(`arc ${a.slice(0, 3).join(' ')}`),
      fill: () => log.push(`fill ${ctx.fillStyle}`),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
  }

  it('turns 0xRRGGBB and alpha into CSS colors and paints rectangles, triangles and circles', () => {
    const { ctx, log } = fakeContext();
    const brush = canvasBrush(ctx);
    brush.fillStyle(0xd2f58c).fillRect(1, 2, 3, 4);
    brush.fillStyle(0x000000, 0.5).fillRect(0, 0, 1, 1);
    brush.fillTriangle(0, 0, 10, 0, 5, 8);
    brush.fillCircle(5, 6, 3);
    brush.lineStyle(2, 0x9e9e9e).strokeRect(1, 1, 5, 5);
    expect(log[0]).toBe('fillRect 1 2 3 4 rgba(210, 245, 140, 1)');
    expect(log[1]).toBe('fillRect 0 0 1 1 rgba(0, 0, 0, 0.5)');
    expect(log).toContain('move 0 0');
    expect(log).toContain('arc 5 6 3');
    expect(log).toContain('strokeRect 1 1 5 5 rgba(158, 158, 158, 1) 2');
  });

  it('can run the whole street without errors', () => {
    const { ctx, log } = fakeContext();
    expect(() => drawStreet(canvasBrush(ctx), SCENE.day, seededRandom(STREET_SEED))).not.toThrow();
    expect(log.length).toBeGreaterThan(100);
  });
});

describe('the landing page', () => {
  const body = new DOMParser().parseFromString(applyBrand(readFileSync('index.html', 'utf8')), 'text/html').body.innerHTML;

  function setup(reducedMotion: boolean): void {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    window.matchMedia = ((query: string) => ({
      matches: reducedMotion && query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    // jsdom has no layout: give the street section the height it has in the browser (3.2 screens)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('lp-street') ? 3200 : 0;
      },
    });
    window.scrollTo = vi.fn();
    document.body.innerHTML = body;
    document.documentElement.classList.add('is-landing');
    document.documentElement.dataset.theme = 'night';
    window.history.replaceState(null, '', '/');
    initLanding();
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
    document.documentElement.classList.remove('is-landing');
  });

  const q = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

  it('has the navbar the page promised: Produto, Certificações, Quem somos and Entrar', () => {
    setup(false);
    const links = [...document.querySelectorAll('.lp-links a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Produto', '#produto'],
      ['Certificações', '#certificacoes'],
      ['Quem somos', '#quem-somos'],
    ]);
    expect(document.querySelector('#produto')).not.toBeNull();
    expect(document.querySelector('#quem-somos')).not.toBeNull();
    expect(q('[data-nav] [data-enter]').textContent).toBe('Jogar'); // no backend in this test: just play
  });

  it('lists every game mode of the game, with its real title', () => {
    setup(false);
    const titles = [...document.querySelectorAll('[data-modes] h3')].map((h) => h.textContent);
    expect(titles).toEqual(GAME_STYLES.map((style) => style.title));
  });

  it('the menu button opens and closes the links on small screens', () => {
    setup(false);
    const button = q<HTMLButtonElement>('[data-menu]');
    button.click();
    expect(q('#lp-links').classList.contains('is-open')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(q('#lp-links').classList.contains('is-open')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('the theme button flips day and night and says which one is on', () => {
    setup(false);
    const button = q<HTMLButtonElement>('[data-theme-toggle]');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(document.documentElement.dataset.theme).toBe('day');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toContain('Tema claro');
    button.click();
    expect(document.documentElement.dataset.theme).toBe('night');
  });

  it('wears the brand from src/brand.ts everywhere: wordmark, sign and footer', () => {
    setup(false);
    expect(document.body.innerHTML).not.toContain('{{BRAND');
    expect(q('.lp-brand').textContent).toBe(BRAND.light + BRAND.bold);
    expect(q('.lp-sign').textContent).toBe(BRAND.light + BRAND.bold);
    expect(q('.lp-footer').textContent).toContain(BRAND.name);
  });

  it('the certification picker offers the available room and announces the ones coming', () => {
    setup(false);
    const cards = [...document.querySelectorAll<HTMLElement>('[data-certs] .lp-cert')];
    expect(cards.map((card) => card.dataset.certId)).toEqual(CERTIFICATIONS.map((c) => c.id));
    const available = cards.find((card) => card.dataset.certId === 'compliance')!;
    expect(available.getAttribute('role')).toBe('radio');
    expect(available.getAttribute('aria-checked')).toBe('false');
    const soon = cards.find((card) => card.classList.contains('lp-cert--soon'))!;
    expect(soon.getAttribute('aria-disabled')).toBe('true');
    expect(soon.getAttribute('role')).toBeNull();
    expect(soon.textContent).toContain('Em breve');
  });

  it('choosing a certification marks it, says so, and remembers it for the game hall', () => {
    window.localStorage.removeItem('qh.focusRoom.v1');
    setup(false);
    const card = q('[data-cert-id="compliance"]');
    card.click();
    expect(card.getAttribute('aria-checked')).toBe('true');
    expect(q('[data-cert-status]').textContent).toContain('Seu foco: Certificação ABT1');
    expect(readFocusRoom(window.localStorage)).toBe('compliance');
  });

  it('comes back with the choice already marked', () => {
    window.localStorage.setItem('qh.focusRoom.v1', 'compliance');
    setup(false);
    expect(q('[data-cert-id="compliance"]').getAttribute('aria-checked')).toBe('true');
    window.localStorage.removeItem('qh.focusRoom.v1');
  });

  it('does not promise what the product cannot do yet', () => {
    setup(false);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/exportar ou apagar|nível por tema|questões originais/i);
    expect(text).toMatch(/não é afiliado, aprovado nem oficial/i);
  });

  it('the hero starts on the left, away from the door, and the door button is hidden', () => {
    setup(false);
    expect(q('[data-hero]').style.getPropertyValue('--hx')).toBe(String(HERO_START_X.toFixed(1)));
    expect(q('[data-door]').classList.contains('is-ready')).toBe(false);
    expect(q('[data-door]').getAttribute('aria-hidden')).toBe('true');
    expect(q('[data-door]').tabIndex).toBe(-1);
  });

  it('with reduced motion the hero is already at the door and the door button can be reached', () => {
    setup(true);
    expect(q('[data-hero]').style.getPropertyValue('--hx')).toBe(STREET.doorX.toFixed(1));
    expect(q('[data-hero]').classList.contains('is-facing-door')).toBe(true);
    expect(q('[data-door]').classList.contains('is-ready')).toBe(true);
    expect(q('[data-door]').tabIndex).toBe(0);
  });
});
