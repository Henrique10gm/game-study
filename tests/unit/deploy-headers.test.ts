import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// public/_headers is what Cloudflare Pages applies in production. These checks
// stop a careless edit from loosening the policy or breaking sign-in.
const headersFile = readFileSync('public/_headers', 'utf8');

function headerValue(name: string): string {
  const line = headersFile.split(/\r?\n/).find((l) => l.trim().toLowerCase().startsWith(`${name.toLowerCase()}:`));
  if (!line) throw new Error(`header ${name} missing from public/_headers`);
  return line.slice(line.indexOf(':') + 1).trim();
}

function directive(csp: string, name: string): string[] {
  const part = csp.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name} `) || p === name);
  return part ? part.split(/\s+/).slice(1) : [];
}

describe('production headers', () => {
  const csp = headerValue('Content-Security-Policy');

  it('never allows inline or eval script', () => {
    const scripts = directive(csp, 'script-src');
    expect(scripts).toContain("'self'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
  });

  it('lets the game reach only its own Supabase project and the Turnstile widget', () => {
    expect(directive(csp, 'script-src')).toContain('https://challenges.cloudflare.com');
    expect(directive(csp, 'frame-src')).toEqual(['https://challenges.cloudflare.com']);
    const connect = directive(csp, 'connect-src');
    expect(connect).toContain("'self'");
    expect(connect.filter((source) => source !== "'self'")).toEqual([expect.stringMatching(/^https:\/\/[a-z0-9]+\.supabase\.co$/)]);
    expect(connect.join(' ')).not.toContain('*');
    expect(connect.join(' ')).not.toContain('google');
  });

  it('blocks plugins, base-tag tricks and framing', () => {
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'none'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('sets the basic hardening headers', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerValue('Strict-Transport-Security')).toContain('max-age=');
    expect(headerValue('Permissions-Policy')).toContain('camera=()');
  });

  it('caches only the hashed assets for a long time', () => {
    const block = headersFile.split(/\r?\n(?=\S)/).find((b) => b.startsWith('/assets/*'));
    expect(block).toContain('immutable');
    expect(headersFile.split(/\r?\n(?=\S)/).find((b) => b.startsWith('/*'))).not.toContain('Cache-Control');
  });
});

describe('index.html CSP (used by the dev server)', () => {
  it('does not mention the old Google backend', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toContain('script.google.com');
    expect(html).toContain('challenges.cloudflare.com');
  });
});
