// The landing page: navbar, text sections, and a street that the visitor "walks" down by
// scrolling until the bank door. The street is drawn by the same code as the game's first
// scene (same seed, same palette), so when the visitor enters it feels like the game was
// already running. Phaser, Supabase and the game are loaded only when they are needed.
import './landing.css';
import '../engine/ui/pixel.css';
import type { Session } from '@supabase/supabase-js';
import { scene } from '../engine/palette';
import { GAME_STYLES } from '../engine/styles';
import { drawSky, drawStreet, seededRandom, STREET_SEED } from '../engine/scenes/street';
import { currentTheme, THEME_EVENT, toggleTheme } from '../engine/theme';
import { showLoader } from '../engine/ui/bootLoader';
import { readFocusRoom, saveFocusRoom } from '../state/certFocus';
import { captureInviteFromUrl } from '../state/inviteLink';
import { availableCertifications, CERTIFICATIONS } from './certifications';
import { canvasBrush } from './canvasBrush';
import { shouldSkipLanding } from './entry';
import { atDoor, cameraShift, heroX, sectionProgress } from './scroll';

const PREFETCH_AT = 0.55; // start downloading the game once the visitor is this far down the street
const HINT_UNTIL = 0.08;

function find<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`landing: ${selector} not found in index.html`);
  return element;
}

function hasBackend(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/** A saved sign-in is in this browser: the button says "Jogar" instead of "Entrar". */
function hasSavedSession(): boolean {
  try {
    return Object.keys(window.localStorage).some((key) => /^sb-.+-auth-token$/.test(key));
  } catch {
    return false;
  }
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// ---------------------------------------------------------------- the pictures

function paint(root: HTMLElement): void {
  const P = scene();
  const sky = find<HTMLCanvasElement>(root, '[data-hero-sky]');
  const street = find<HTMLCanvasElement>(root, '[data-street-canvas]');
  const skyCtx = sky.getContext('2d');
  const streetCtx = street.getContext('2d');
  if (skyCtx) drawSky(canvasBrush(skyCtx), P, seededRandom(STREET_SEED));
  if (streetCtx) drawStreet(canvasBrush(streetCtx), P, seededRandom(STREET_SEED));
}

function fillModes(root: HTMLElement): void {
  const list = find<HTMLElement>(root, '[data-modes]');
  GAME_STYLES.forEach((style, index) => {
    const item = document.createElement('li');
    item.className = 'lp-card px-box';
    item.dataset.reveal = '';
    const tag = document.createElement('span');
    tag.className = 'lp-mode-tag';
    tag.textContent = `Modo ${index + 1}`;
    const title = document.createElement('h3');
    title.textContent = style.title;
    const text = document.createElement('p');
    text.textContent = style.description;
    item.append(tag, title, text);
    list.appendChild(item);
  });
}

// The certification picker: the chosen room is remembered here and, in the game, its door
// is marked "Sua sala". Choosing is optional; the hall is never locked to one room.
function setupCertifications(root: HTMLElement, storage: Storage | null): void {
  const box = find<HTMLElement>(root, '[data-certs]');
  const status = find<HTMLElement>(root, '[data-cert-status]');
  const known = new Set(availableCertifications().map((certification) => certification.id));
  const saved = readFocusRoom(storage);
  let chosen = saved && known.has(saved) ? saved : null;
  const cards = new Map<string, HTMLElement>();

  const refresh = (announce: boolean): void => {
    cards.forEach((card, id) => card.setAttribute('aria-checked', String(id === chosen)));
    const title = CERTIFICATIONS.find((certification) => certification.id === chosen)?.title;
    status.textContent = title
      ? `${announce ? 'Anotado. ' : ''}Seu foco: ${title}. Na casa, a porta dessa sala fica em destaque.`
      : '';
  };

  for (const certification of CERTIFICATIONS) {
    const available = certification.status === 'available';
    const card = document.createElement(available ? 'button' : 'div');
    card.className = 'lp-cert px-box' + (available ? '' : ' lp-cert--soon');
    card.dataset.reveal = '';
    card.dataset.certId = certification.id;
    const tag = document.createElement('span');
    tag.className = 'lp-mode-tag' + (available ? '' : ' lp-mode-tag--soon');
    tag.textContent = available ? 'Disponível agora' : 'Em breve';
    const title = document.createElement('h3');
    title.textContent = certification.title;
    const text = document.createElement('p');
    text.textContent = certification.blurb;
    card.append(tag, title, text);
    if (available) {
      const button = card as HTMLButtonElement;
      button.type = 'button';
      button.setAttribute('role', 'radio');
      const pick = document.createElement('span');
      pick.className = 'lp-cert-pick';
      pick.textContent = 'Treinar esta';
      card.append(pick);
      button.addEventListener('click', () => {
        chosen = certification.id;
        saveFocusRoom(storage, certification.id);
        refresh(true);
      });
      cards.set(certification.id, card);
    } else {
      card.setAttribute('aria-disabled', 'true');
    }
    box.appendChild(card);
  }
  refresh(false);
}

function revealOnScroll(root: HTMLElement): void {
  root.classList.add('has-js');
  const cards = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!('IntersectionObserver' in window)) {
    cards.forEach((card) => card.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  cards.forEach((card) => observer.observe(card));
}

// ---------------------------------------------------------------------- navbar

function setupNav(root: HTMLElement): void {
  const nav = find<HTMLElement>(root, '[data-nav]');
  const links = find<HTMLElement>(root, '#lp-links');
  const menuButton = find<HTMLButtonElement>(root, '[data-menu]');
  const themeButton = find<HTMLButtonElement>(root, '[data-theme-toggle]');
  const produto = find<HTMLElement>(root, '#produto');
  const certificacoes = find<HTMLElement>(root, '#certificacoes');
  const modos = find<HTMLElement>(root, '#modos');
  const quem = find<HTMLElement>(root, '#quem-somos');
  const street = find<HTMLElement>(root, '#entrada');

  const refreshTheme = (): void => {
    const day = currentTheme() === 'day';
    themeButton.textContent = day ? '☀' : '☾';
    themeButton.setAttribute('aria-pressed', String(day));
    themeButton.setAttribute('aria-label', day ? 'Tema claro. Mudar para escuro' : 'Tema escuro. Mudar para claro');
  };
  refreshTheme();
  themeButton.addEventListener('click', () => toggleTheme());
  window.addEventListener(THEME_EVENT, () => {
    refreshTheme();
    paint(root);
  });

  const closeMenu = (): void => {
    links.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir o menu');
  };
  menuButton.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar o menu' : 'Abrir o menu');
  });
  links.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) closeMenu();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const onScroll = (): void => {
    nav.classList.toggle('is-solid', window.scrollY > 40);
    const y = window.scrollY + 160;
    let current: string | null = null;
    if (y >= street.offsetTop) current = null;
    else if (y >= quem.offsetTop) current = '#quem-somos';
    else if (y >= modos.offsetTop) current = '#produto';
    else if (y >= certificacoes.offsetTop) current = '#certificacoes';
    else if (y >= produto.offsetTop) current = '#produto';
    links.querySelectorAll('a').forEach((link) => {
      if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ------------------------------------------------------------ the walk to the door

interface Street {
  progress(): number;
  /** Scrolls to the end of the street and resolves once the hero stands at the door. */
  walkToDoor(): Promise<void>;
  enterDoor(): Promise<void>;
}

function setupStreet(root: HTMLElement): Street {
  const section = find<HTMLElement>(root, '[data-street]');
  const stage = find<HTMLElement>(root, '[data-stage]');
  const hero = find<HTMLElement>(root, '[data-hero]');
  const door = find<HTMLButtonElement>(root, '[data-door]');
  const hint = find<HTMLElement>(root, '[data-street-hint]');
  const fade = find<HTMLElement>(root, '[data-fade]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let lastP = -1;
  let stopTimer = 0;
  let frame = 0;
  let prefetched = false;

  const progress = (): number =>
    reduced.matches ? 1 : sectionProgress(window.scrollY, section.offsetTop, section.offsetHeight, window.innerHeight);

  const update = (): void => {
    frame = 0;
    const p = progress();
    const x = heroX(p);
    const stageWidth = stage.offsetWidth;
    hero.style.setProperty('--hx', x.toFixed(1));
    stage.style.setProperty('--cam', `${cameraShift((x / 960) * stageWidth, stageWidth, window.innerWidth).toFixed(1)}px`);

    const arrived = atDoor(p);
    hero.classList.toggle('is-facing-door', arrived);
    const moved = lastP >= 0 ? p - lastP : 0;
    if (!arrived && Math.abs(moved) > 0.0004) {
      hero.classList.toggle('is-walking-right', moved > 0);
      hero.classList.toggle('is-walking-left', moved < 0);
      window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => hero.classList.remove('is-walking-right', 'is-walking-left'), 150);
    } else if (arrived) {
      hero.classList.remove('is-walking-right', 'is-walking-left');
    }

    door.classList.toggle('is-ready', arrived);
    door.setAttribute('aria-hidden', String(!arrived));
    door.tabIndex = arrived ? 0 : -1;
    hint.classList.toggle('is-hidden', p > HINT_UNTIL);

    if (!prefetched && p >= PREFETCH_AT) {
      prefetched = true;
      void import('../game');
    }
    lastP = p;
  };
  const schedule = (): void => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();

  const travel = (): number => section.offsetHeight - window.innerHeight;
  const endY = (): number => section.offsetTop + travel();

  return {
    progress,
    async walkToDoor(): Promise<void> {
      if (atDoor(progress())) return;
      // Skip the text sections: jump to the middle of the street, then walk the rest.
      window.scrollTo({ top: section.offsetTop + travel() * 0.35, behavior: 'auto' });
      await wait(60);
      window.scrollTo({ top: endY(), behavior: reduced.matches ? 'auto' : 'smooth' });
      for (let waited = 0; waited < 2500 && !atDoor(progress()); waited += 50) await wait(50);
      update();
    },
    async enterDoor(): Promise<void> {
      hero.classList.remove('is-walking-right', 'is-walking-left');
      hero.classList.add('is-entering');
      await wait(reduced.matches ? 0 : 600);
      fade.classList.add('is-on');
      await wait(reduced.matches ? 0 : 380);
    },
  };
}

// ----------------------------------------------------------- sign in over the street

/** The sign-in form over the street. Resolves with the session, or null if the visitor goes back. */
async function askForSession(root: HTMLElement): Promise<Session | null> {
  const [{ sharedSupabase }, { AuthGate }] = await Promise.all([import('../auth/supabaseClient'), import('../auth/AuthGate')]);
  const client = sharedSupabase();
  if (!client) return null;
  const saved = await client.auth.getSession();
  if (saved.data.session) return saved.data.session;

  return new Promise<Session | null>((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'lp-overlay';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'lp-overlay-back';
    back.textContent = '← Voltar para a página';
    root.append(overlay, back);

    const gate = new AuthGate({
      client,
      uiRoot: overlay,
      overlay: true,
      turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
    });
    const close = (session: Session | null): void => {
      window.removeEventListener('keydown', onKey);
      if (!session) gate.cancel();
      overlay.remove();
      back.remove();
      resolve(session);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close(null);
    };
    back.addEventListener('click', () => close(null));
    window.addEventListener('keydown', onKey);
    void gate.run().then((session) => close(session));
  });
}

// ------------------------------------------------------------------------ start

/** Hides the landing and starts the game (loading its code now, not before). */
async function launch(session?: Session): Promise<void> {
  document.documentElement.classList.remove('is-landing');
  showLoader();
  const { startGame } = await import('../game');
  await startGame({ session, startAt: 'hall' });
}

export function initLanding(): void {
  const storage = browserStorage();
  // An invite link may be opened before signing in: keep the code until the player is in.
  captureInviteFromUrl(storage);

  // Coming back from an e-mail link (confirmation, password recovery): no landing, straight to the game.
  if (shouldSkipLanding()) {
    document.documentElement.classList.remove('is-landing');
    showLoader();
    void import('../game').then(({ startGame }) => startGame());
    return;
  }

  const root = find<HTMLElement>(document, '#landing');
  paint(root);
  fillModes(root);
  setupCertifications(root, storage);
  setupNav(root);
  const street = setupStreet(root);
  revealOnScroll(root);

  const label = hasSavedSession() || !hasBackend() ? 'Jogar' : 'Entrar';
  root.querySelectorAll<HTMLElement>('[data-enter-label]').forEach((button) => {
    button.textContent = label;
  });

  let busy = false;
  const enter = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      await street.walkToDoor();
      let session: Session | undefined;
      if (hasBackend()) {
        const answered = await askForSession(root);
        if (!answered) return; // went back to the page
        session = answered;
      }
      await street.enterDoor();
      await launch(session);
    } finally {
      busy = false;
    }
  };
  root.querySelectorAll<HTMLElement>('[data-enter]').forEach((button) => button.addEventListener('click', () => void enter()));
}
