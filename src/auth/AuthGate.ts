// Sign-in gate: shows login / sign-up / forgot-password / new-password forms over the
// game until there is a session. Passwords are handled only by Supabase Auth (never
// stored or logged here). Confirmation e-mail and password recovery links come back
// to this page; the client picks the session up from the URL on its own.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { mountCaptcha } from './turnstile';
import type { CaptchaHandle } from './turnstile';
import './auth.css';

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';

export const MIN_PASSWORD = 8;

export interface AuthGateOptions {
  client: SupabaseClient;
  uiRoot: HTMLElement;
  /** Cloudflare Turnstile site key; omit to run without the anti-bot check. */
  turnstileSiteKey?: string;
}

interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

export function friendlyAuthError(error: AuthErrorLike): string {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid_credentials')) return 'E-mail ou senha incorretos.';
  if (text.includes('email not confirmed') || text.includes('email_not_confirmed')) {
    return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  }
  if (text.includes('weak_password') || text.includes('password should')) {
    return `Senha fraca. Use ao menos ${MIN_PASSWORD} caracteres.`;
  }
  if (text.includes('rate') || error.status === 429) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (text.includes('captcha')) return 'A verificação anti-robô falhou. Tente de novo.';
  if (text.includes('same_password') || text.includes('different from the old')) return 'Escolha uma senha diferente da atual.';
  if (text.includes('fetch') || text.includes('network')) return 'Sem conexão com o servidor. Tente de novo.';
  return 'Não foi possível concluir. Tente de novo.';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Resolves with the session once the player is signed in (immediately if one is already saved). */
export function requireSession(opts: AuthGateOptions): Promise<Session> {
  return new AuthGate(opts).run();
}

export class AuthGate {
  private readonly root: HTMLElement;
  private captcha: CaptchaHandle | null = null;
  private resolve: ((session: Session) => void) | null = null;
  private recovering = false;

  constructor(private readonly opts: AuthGateOptions) {
    this.root = el('div', 'auth-screen');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Entrar');
  }

  run(): Promise<Session> {
    return new Promise<Session>((resolve) => {
      this.resolve = resolve;
      const { client } = this.opts;
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          this.recovering = true;
          this.show('recovery');
        } else if (session && !this.recovering) {
          this.finish(session);
        }
      });
      void client.auth.getSession().then(({ data }) => {
        if (this.recovering) return;
        if (data.session) this.finish(data.session);
        else this.show('signin');
      });
    });
  }

  private finish(session: Session): void {
    this.captcha?.destroy();
    this.captcha = null;
    this.root.remove();
    const done = this.resolve;
    this.resolve = null;
    done?.(session);
  }

  private show(mode: AuthMode): void {
    this.captcha?.destroy();
    this.captcha = null;
    this.root.replaceChildren(this.buildCard(mode));
    if (!this.root.isConnected) this.opts.uiRoot.appendChild(this.root);
    this.root.querySelector<HTMLInputElement>('input')?.focus();
  }

  private buildCard(mode: AuthMode): HTMLElement {
    const card = el('form', 'auth-card');
    card.noValidate = true;
    const titles: Record<AuthMode, string> = {
      signin: 'Entrar',
      signup: 'Criar conta',
      forgot: 'Recuperar senha',
      recovery: 'Nova senha',
    };
    card.appendChild(el('p', 'auth-kicker', 'Quest Hall · Salão de Jogos'));
    card.appendChild(el('h1', 'auth-title', titles[mode]));

    const message = el('p', 'auth-message');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');

    const field = (label: string, type: string, autocomplete: AutoFill, testId: string): HTMLInputElement => {
      const wrap = el('label', 'auth-field');
      wrap.appendChild(el('span', 'auth-label', label));
      const input = el('input', 'auth-input');
      input.type = type;
      input.autocomplete = autocomplete;
      input.required = true;
      input.dataset.testid = testId;
      if (type === 'email') input.spellcheck = false;
      wrap.appendChild(input);
      card.appendChild(wrap);
      return input;
    };

    const email = mode === 'recovery' ? null : field('E-mail', 'email', 'email', 'auth-email');
    const password =
      mode === 'forgot' ? null : field(mode === 'recovery' ? 'Nova senha' : 'Senha', 'password', mode === 'signin' ? 'current-password' : 'new-password', 'auth-password');

    if (mode === 'signup' || mode === 'recovery') {
      card.appendChild(el('p', 'auth-hint', `Mínimo de ${MIN_PASSWORD} caracteres.`));
    }
    if (mode === 'signup') {
      card.appendChild(
        el(
          'p',
          'auth-hint',
          'Guardamos seu e-mail, seu apelido e o que você joga (acertos, XP e questões erradas). O e-mail nunca aparece no ranking.',
        ),
      );
    }

    const captchaBox = el('div', 'auth-captcha');
    if (mode !== 'recovery') card.appendChild(captchaBox);
    card.appendChild(message);

    const submit = el('button', 'menu-btn auth-submit', titles[mode]);
    submit.type = 'submit';
    submit.dataset.testid = 'auth-submit';
    card.appendChild(submit);

    const links = el('div', 'auth-links');
    const link = (text: string, to: AuthMode): void => {
      const button = el('button', 'auth-link', text);
      button.type = 'button';
      button.addEventListener('click', () => this.show(to));
      links.appendChild(button);
    };
    if (mode === 'signin') {
      link('Criar conta', 'signup');
      link('Esqueci a senha', 'forgot');
    } else if (mode !== 'recovery') {
      link('Já tenho conta', 'signin');
    }
    card.appendChild(links);

    if (mode !== 'recovery') {
      void mountCaptcha(captchaBox, this.opts.turnstileSiteKey)
        .then((handle) => {
          this.captcha = handle;
        })
        .catch(() => {
          message.textContent = 'Não foi possível carregar a verificação anti-robô. Recarregue a página.';
        });
    }

    card.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit(mode, email?.value.trim() ?? '', password?.value ?? '', message, submit);
    });
    return card;
  }

  private async submit(
    mode: AuthMode,
    email: string,
    password: string,
    message: HTMLElement,
    submit: HTMLButtonElement,
  ): Promise<void> {
    message.classList.remove('is-ok');
    if (mode !== 'recovery' && !/^\S+@\S+\.\S+$/.test(email)) {
      message.textContent = 'Informe um e-mail válido.';
      return;
    }
    if (mode !== 'forgot' && mode !== 'signin' && password.length < MIN_PASSWORD) {
      message.textContent = `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`;
      return;
    }
    if (mode === 'signin' && !password) {
      message.textContent = 'Informe a senha.';
      return;
    }
    const captchaToken = this.captcha?.token() ?? undefined;
    if (this.opts.turnstileSiteKey && mode !== 'recovery' && !captchaToken) {
      message.textContent = 'Conclua a verificação anti-robô.';
      return;
    }

    submit.disabled = true;
    message.textContent = '';
    try {
      const { auth } = this.opts.client;
      const origin = window.location.origin;
      if (mode === 'signin') {
        const { error } = await auth.signInWithPassword({ email, password, options: { captchaToken } });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { captchaToken, emailRedirectTo: origin },
        });
        if (error) throw error;
        // With e-mail confirmation on there is no session yet: wait for the link.
        if (!data.session) {
          message.classList.add('is-ok');
          message.textContent = 'Enviamos um link de confirmação para o seu e-mail. Confirme e volte para entrar.';
        }
      } else if (mode === 'forgot') {
        const { error } = await auth.resetPasswordForEmail(email, { captchaToken, redirectTo: origin });
        if (error) throw error;
        message.classList.add('is-ok');
        // Same answer whether or not the account exists.
        message.textContent = 'Se esse e-mail tiver conta, enviamos um link para criar uma nova senha.';
      } else {
        const { data, error } = await auth.updateUser({ password });
        if (error) throw error;
        this.recovering = false;
        const { data: current } = await auth.getSession();
        if (current.session) this.finish(current.session);
        else if (data.user) this.show('signin');
      }
    } catch (error) {
      message.textContent = friendlyAuthError(error as AuthErrorLike);
    } finally {
      submit.disabled = false;
      this.captcha?.reset();
    }
  }
}

/** Small "Sair" control kept over the game; signing out reloads so nothing of the old account stays in memory. */
export function mountSignOut(client: SupabaseClient, uiRoot: HTMLElement): void {
  const button = el('button', 'auth-signout', 'Sair');
  button.type = 'button';
  button.dataset.testid = 'auth-signout';
  button.addEventListener('click', () => {
    void client.auth.signOut().finally(() => window.location.reload());
  });
  uiRoot.appendChild(button);
}
