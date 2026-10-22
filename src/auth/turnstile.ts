// Cloudflare Turnstile (anti-bot) for sign-up and sign-in. Supabase Auth checks the
// token on the server when "CAPTCHA protection" is on in the dashboard. Without a
// site key (local dev) nothing is shown and no token is sent.
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

export interface CaptchaHandle {
  /** The current token, or null while the check has not finished. */
  token(): string | null;
  /** Tokens are single-use: ask for a new one after every attempt. */
  reset(): void;
  destroy(): void;
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  const existing = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api) resolve(api);
      else reject(new Error('turnstile missing'));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function mountCaptcha(container: HTMLElement, siteKey: string | undefined): Promise<CaptchaHandle | null> {
  if (!siteKey) return null;
  const api = await loadScript();
  let current: string | null = null;
  const widgetId = api.render(container, {
    sitekey: siteKey,
    theme: 'dark',
    callback: (value: string) => (current = value),
    'expired-callback': () => (current = null),
    'error-callback': () => (current = null),
  });
  return {
    token: () => current,
    reset: () => {
      current = null;
      api.reset(widgetId);
    },
    destroy: () => api.remove(widgetId),
  };
}
