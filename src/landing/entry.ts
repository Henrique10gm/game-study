// Who sees the landing page. A visitor sees it first; but when the address carries the
// answer of a sign-in step (the link of the confirmation e-mail, a password recovery, an
// error from the auth server) the page goes straight to the game, which finishes that step.
type Where = Pick<Location, 'search' | 'hash'>;

export function shouldSkipLanding(where: Where = window.location): boolean {
  const hash = where.hash.replace(/^#/, '');
  const search = where.search.replace(/^\?/, '');
  if (/(^|&)(access_token|refresh_token|error|error_code|error_description)=/.test(hash)) return true;
  if (/(^|&)type=(recovery|signup|invite|magiclink|email_change)(&|$)/.test(hash)) return true;
  if (/(^|&)(code|error|error_code|error_description)=/.test(search)) return true;
  // A way in for returning players (a bookmark): /?jogar
  return /(^|&)jogar(=|&|$)/.test(search);
}
