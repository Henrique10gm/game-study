import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { friendlyAuthError, requireSession } from '../../src/auth/AuthGate';

const SESSION = { user: { id: 'u1' } } as unknown as Session;

type Listener = (event: string, session: Session | null) => void;

function fakeAuth(initial: Session | null = null) {
  let listener: Listener | null = null;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: initial } })),
    onAuthStateChange: vi.fn((fn: Listener) => {
      listener = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ data: { user: {} }, error: null })),
    signOut: vi.fn(async () => ({})),
  };
  return {
    auth,
    client: { auth } as unknown as SupabaseClient,
    emit: (event: string, session: Session | null) => listener?.(event, session),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AuthGate', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });
  afterEach(() => root.remove());

  const q = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  const type = (testId: string, value: string) => {
    (q(`[data-testid="${testId}"]`) as HTMLInputElement).value = value;
  };
  const submit = async () => {
    q('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await flush();
  };

  it('skips the form when a session is already saved', async () => {
    const { client } = fakeAuth(SESSION);
    expect(await requireSession({ client, uiRoot: root })).toBe(SESSION);
    expect(root.querySelector('.auth-screen')).toBeNull();
  });

  it('signs in with e-mail and password and resolves with the session', async () => {
    const { client, auth, emit } = fakeAuth();
    const pending = requireSession({ client, uiRoot: root });
    await flush();
    expect(q('.auth-title').textContent).toBe('Entrar');

    type('auth-email', ' ana@example.com ');
    type('auth-password', 'segredo123');
    await submit();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'segredo123',
      options: { captchaToken: undefined },
    });
    emit('SIGNED_IN', SESSION);
    expect(await pending).toBe(SESSION);
    expect(root.querySelector('.auth-screen')).toBeNull();
  });

  it('shows a friendly message for wrong credentials and does not resolve', async () => {
    const { client, auth } = fakeAuth();
    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    void requireSession({ client, uiRoot: root });
    await flush();
    type('auth-email', 'ana@example.com');
    type('auth-password', 'errada');
    await submit();
    expect(q('.auth-message').textContent).toBe('E-mail ou senha incorretos.');
    expect(root.querySelector('.auth-screen')).not.toBeNull();
  });

  it('sign-up needs a long enough password and then asks for the e-mail confirmation', async () => {
    const { client, auth } = fakeAuth();
    void requireSession({ client, uiRoot: root });
    await flush();
    q('.auth-link').click(); // "Criar conta"
    expect(q('.auth-title').textContent).toBe('Criar conta');

    type('auth-email', 'ana@example.com');
    type('auth-password', 'curta');
    await submit();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(q('.auth-message').textContent).toContain('ao menos 8');

    type('auth-password', 'uma-senha-longa');
    await submit();
    expect(auth.signUp).toHaveBeenCalledOnce();
    expect(q('.auth-message').textContent).toContain('link de confirmação');
  });

  it('forgot-password gives the same answer for any e-mail', async () => {
    const { client, auth } = fakeAuth();
    void requireSession({ client, uiRoot: root });
    await flush();
    q('.auth-links .auth-link:nth-child(2)').click(); // "Esqueci a senha"
    type('auth-email', 'ninguem@example.com');
    await submit();
    expect(auth.resetPasswordForEmail).toHaveBeenCalled();
    expect(q('.auth-message').textContent).toContain('Se esse e-mail tiver conta');
  });

  it('a recovery link opens the new-password form and only then lets the player in', async () => {
    const { client, auth, emit } = fakeAuth();
    const pending = requireSession({ client, uiRoot: root });
    await flush();
    emit('PASSWORD_RECOVERY', SESSION);
    expect(q('.auth-title').textContent).toBe('Nova senha');
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });

    type('auth-password', 'nova-senha-123');
    await submit();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nova-senha-123' });
    expect(await pending).toBe(SESSION);
  });
});

describe('friendlyAuthError', () => {
  it('translates the common cases and never leaks raw server text', () => {
    expect(friendlyAuthError({ message: 'Email not confirmed' })).toContain('Confirme seu e-mail');
    expect(friendlyAuthError({ status: 429, message: 'x' })).toContain('Muitas tentativas');
    expect(friendlyAuthError({ code: 'weak_password' })).toContain('Senha fraca');
    expect(friendlyAuthError({ message: 'database exploded at row 7' })).toBe('Não foi possível concluir. Tente de novo.');
  });
});
