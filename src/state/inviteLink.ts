// An invite link looks like https://<site>/?convite=<token>. The token is kept in
// the browser until the player is signed in (sign-up and the e-mail confirmation
// may happen in between), then used once and forgotten.
import { INVITE_PARAM, parseInviteToken } from './GroupService';

const PENDING_KEY = 'qh.pendingInvite.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Reads ?convite= from the address, remembers it, and removes it from the address bar. */
export function captureInviteFromUrl(
  storage: StorageLike | null,
  loc: Pick<Location, 'search' | 'pathname' | 'hash'> = window.location,
  history: Pick<History, 'replaceState'> = window.history,
): string | null {
  const params = new URLSearchParams(loc.search);
  const raw = params.get(INVITE_PARAM);
  if (raw === null) return null;
  params.delete(INVITE_PARAM);
  const rest = params.toString();
  history.replaceState(null, '', `${loc.pathname}${rest ? `?${rest}` : ''}${loc.hash}`);

  const token = parseInviteToken(raw);
  if (token) {
    try {
      storage?.setItem(PENDING_KEY, token);
    } catch {
      // storage unavailable: the invite only works in this page load
    }
  }
  return token;
}

/** The remembered invite token (once): reading it clears it. */
export function takePendingInvite(storage: StorageLike | null): string | null {
  try {
    const token = storage?.getItem(PENDING_KEY) ?? null;
    storage?.removeItem(PENDING_KEY);
    return token && parseInviteToken(token) ? token : null;
  } catch {
    return null;
  }
}
