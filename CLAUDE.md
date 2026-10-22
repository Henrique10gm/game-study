# Quest Hall

Salão de jogos de estudo no navegador (Phaser 3 + Vite + TypeScript), em migração para backend público.

**Leia `HANDOFF.md` primeiro.** Ele tem o objetivo, as decisões, o modelo de dados e o plano.

## Stack

- Front: Phaser 3.90, Vite 7, TypeScript 5, bundle 100% estático. Hospedagem: Cloudflare Pages.
- Backend (alvo): Supabase (Auth, Postgres, RLS). Sem servidor próprio.
- Testes: Vitest (`npm test`). Telas de UI em DOM/CSS sobre o canvas, não dentro do Phaser.

## Regras

- Nunca versionar segredo. `.env` é ignorado; `.env.example` documenta as chaves. No front só a `anon key` do Supabase. A `service_role` nunca entra no front.
- Toda tabela tem RLS ligada. Mudança de schema só por arquivo em `supabase/migrations/`.
- A persistência fica atrás de `src/state/GameStore.ts`. Novas implementações seguem essa interface.
- Conteúdo de questões é original, em `content/rooms/*`. Nenhum texto de questão em `src/` (há teste que garante).
- Sem marca de empresa em texto, código ou assets. Identidade neutra.
- Antes de concluir uma tarefa: `npm run typecheck` e `npm test`.

## Comandos

- `npm install`
- `npm run dev` (http://localhost:5173)
- `npm test`
- `npm run build`
