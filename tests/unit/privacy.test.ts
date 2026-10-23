import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyBrand } from '../../src/brandHtml';
import { BRAND } from '../../src/brand';

// The policy is written by hand, so these checks keep it in line with what the system really
// stores: if a table of personal data is added to the database, the policy has to mention it.
const policy = applyBrand(readFileSync('privacidade.html', 'utf8'));
const text = new DOMParser().parseFromString(policy, 'text/html').body.textContent ?? '';

const migrations = readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(`supabase/migrations/${file}`, 'utf8'))
  .join('\n');

describe('privacy policy', () => {
  it('has every mark of the brand filled in', () => {
    expect(policy).not.toContain('{{');
    expect(policy).toContain(BRAND.name);
    expect(policy).toContain(`mailto:${BRAND.contact}`);
  });

  it('says when it was last updated and gives a way to be reached', () => {
    expect(text).toMatch(/Última atualização: \d{1,2} de \w+ de \d{4}/);
    expect(text).toContain(BRAND.contact);
  });

  it('mentions each kind of personal data the database keeps', () => {
    // table in the database -> the words the policy must use for it
    const required: Record<string, string> = {
      profiles: 'Apelido',
      games: 'Partidas e respostas',
      answers: 'Partidas e respostas',
      sessions: 'Tempo de uso',
      memberships: 'Grupos',
      reports: 'Reportes de questão',
    };
    for (const [table, words] of Object.entries(required)) {
      expect(migrations, `${table} is no longer a table`).toMatch(new RegExp(`create table public\\.${table}\\b`));
      expect(text, `policy does not mention ${table}`).toContain(words);
    }
    expect(text).toContain('E-mail e senha');
  });

  it('names the two providers that process the data and the transfer abroad', () => {
    expect(text).toContain('Supabase');
    expect(text).toContain('Cloudflare');
    expect(text).toMatch(/Estados Unidos/);
    expect(text).toMatch(/exterior/);
  });

  it('is clear that the e-mail never shows in the ranking and that nothing is sold', () => {
    expect(text).toMatch(/e-mail nunca aparece para ninguém/);
    expect(text).toMatch(/Não vendemos/);
  });

  it('tells the truth about deleting: groups created by the player go too', () => {
    expect(text).toMatch(/grupos que você criou também são apagados/);
    // and that is really what the database does
    expect(migrations).toMatch(/owner_id\s+uuid not null references auth\.users \(id\) on delete cascade/);
  });

  it('lists the LGPD rights and the two things the player can do alone', () => {
    expect(text).toContain('LGPD');
    expect(text).toContain('ANPD');
    expect(text).toContain('Baixar meus dados');
    expect(text).toContain('Excluir minha conta');
  });
});

describe('links to the policy', () => {
  it('the landing page footer, the sign-up card and the account card all point to it', () => {
    expect(readFileSync('index.html', 'utf8')).toContain('href="./privacidade.html"');
    expect(readFileSync('src/auth/AuthGate.ts', 'utf8')).toContain("'./privacidade.html'");
    expect(readFileSync('src/engine/ui/AccountScreen.ts', 'utf8')).toContain('./privacidade.html');
  });

  it('is built as a second page of the site', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("privacidade: 'privacidade.html'");
  });
});
