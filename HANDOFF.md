# HANDOFF — Quest Hall (versão pública, projeto pessoal)

Este documento é o ponto de partida da sessão do Claude pessoal. Leia inteiro antes de qualquer edição.

## 1. O que é

Salão de jogos de estudo no navegador (Phaser 3 + Vite + TypeScript). O personagem anda por um saguão com uma porta por **sala** (tema). Cada sala tem missões, perfil e ranking próprios. O jogo é um runner estilo Flappy Bird: a cada 5 barreiras pausa e faz uma questão; 3 vidas; no fim, revisão dos erros. Modos: obstáculos, tempo, corrida, pacman.

Esta pasta é uma **cópia neutra** de um projeto interno que foi desligado de qualquer empresa. Estado atual: o jogo funciona 100% offline (salva no `localStorage`). Falta o backend público.

## 2. Objetivo desta fase

Migrar a persistência de Google Apps Script + Planilha para **Supabase**, hospedar o front no **Cloudflare Pages**, e entregar:

1. **Login e senha** (conta própria do jogador).
2. **Grupos** (equipe/empresa) com ranking por grupo, e **convite** por link/código para entrar num grupo.
3. **Identidade visual e textual neutra** (sem marca de empresa).

Fora de escopo agora: editor de questões online (o fluxo "Rascunho → Publicado" da planilha antiga), SSO corporativo, pagamento.

## 3. Decisões já tomadas

- Front estático no **Cloudflare Pages**. Sem Workers: a lógica fica no Supabase.
- **Supabase Auth** com e-mail e senha, confirmação de e-mail e recuperação de senha. Não implementar hash de senha à mão.
- **Cloudflare Turnstile** no cadastro e no login (suportado nativamente pelo Supabase Auth) contra spam.
- Segurança por **RLS** no Postgres. O front usa só a `anon key` (pública por desenho). A `service_role` nunca entra no front, no repositório ou em `VITE_*`.
- Um usuário pode estar em **vários grupos**; ranking é por grupo e por sala.
- As questões continuam **embutidas no bundle** (`content/rooms/*`). Sem tabela de questões nesta fase.
- Manter o modo offline/fila local que já existe: `saveGame` devolve `'saved' | 'queued'`.

## 4. Pontos de encaixe no código

O contrato de persistência já existe em `src/state/GameStore.ts`:

```ts
interface GameStore {
  kind: 'local' | 'cloud';
  init(); saveGame(game); listGames(roomId?); getProgress(roomId?);
  getLeaderboard(roomId?); setNickname(nickname); reportQuestion(report);
  recordScreenTime(report);
}
```

- Criar `src/state/SupabaseGameStore.ts` implementando essa interface, e trocar a escolha em `src/state/createStore.ts` (hoje decide por `VITE_APPS_SCRIPT_URL`).
- `src/state/AppsScriptGameStore.ts` é a implementação antiga: use como **referência de comportamento** (validações, fila offline, formato dos registros em `src/state/records.ts`) e remova no fim.
- `src/engine/content/remoteContent.ts` e `draftSheet.ts` buscam questões publicadas na planilha. Remover a busca remota e usar só o bundle.
- `src/main.ts` importa `createLiveContent` e `refreshQuestionBank` de `remoteContent.ts`: ajustar junto.
- `src/vite-env.d.ts` declara `VITE_APPS_SCRIPT_URL`: trocar por `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`.
- `index.html` tem CSP com `connect-src` para `script.google.com`: trocar para `https://<projeto>.supabase.co` (e `wss://` se usar realtime) e permitir o Turnstile em `script-src`/`frame-src`.
- Telas novas (DOM, estilo pixel em `src/engine/ui/*.css`): login/cadastro/recuperar senha, criar grupo, entrar por convite, escolher grupo ativo, gerenciar membros.

## 5. Modelo de dados proposto (Postgres)

Substitui `playerKey` por `user_id` (`auth.users.id`).

| Tabela | Campos principais |
|---|---|
| `profiles` | `id` (PK = auth uid), `nickname` (único, citext, mesma regra do `NICKNAME_RE` de `Code.gs`), `created_at` |
| `groups` | `id`, `name`, `owner_id`, `created_at` |
| `memberships` | `group_id`, `user_id`, `role` (`owner`/`member`), PK composta |
| `invites` | `token` (aleatório, longo), `group_id`, `created_by`, `expires_at`, `max_uses`, `uses` |
| `games` | mesmos campos de hoje (`id`, `mode_id`, `room_id`, `style`, `requested_count`, `answered_count`, `correct_count`, `xp`, `result`, `started_at`, `ended_at`) + `user_id` |
| `answers` | `game_id`, `user_id`, `question_id`, `chosen_choice_id`, `correct`, `answered_at` |
| `sessions` | tempo de tela: `session_id`, `user_id`, `room_id`, `started_at`, `active_seconds` |
| `reports` | reporte de questão: `id`, `user_id`, `question_id`, `room_id`, `reason`, `comment`, `chosen_choice_id`, `correct_choice_id`, `status` |

Regras de RLS:

- `games`, `answers`, `sessions`, `reports`: cada usuário lê e escreve **só as próprias linhas** (`user_id = auth.uid()`). `reports` é só escrita para o jogador.
- `profiles`: leitura do próprio; apelido de outros só via função de ranking.
- `groups`/`memberships`: membro enxerga o grupo e a lista de membros dos seus grupos; só `owner` altera o grupo e gera convite.
- **Ranking** por função `SECURITY DEFINER` (RPC), ex.: `leaderboard(group_id, room_id)`. Devolve apenas agregados (apelido, questões dominadas, XP, nº de partidas) de membros do grupo que o chamador integra. Nunca respostas individuais nem e-mail.
- **Convite**: função `redeem_invite(token)` valida expiração e usos e cria a `membership`. Sem acesso direto de escrita em `memberships` pelo cliente.
- Validação de entrada (faixas de XP, contagens, formatos de id) em `CHECK` constraints e nas funções, replicando `validateGame_` de `backend/Code.gs` (que não vem para cá): `answered_count <= 500`, `xp <= 100000`, `correct_count <= answered_count`, ids com regex.
- Idempotência: `games.id` é UUID gerado no cliente; reenvio da fila offline deve ser ignorado (`on conflict do nothing`).

Versionar tudo em `supabase/migrations/*.sql` (Supabase CLI). Nenhuma chave no repositório.

## 6. Neutralização (marca e texto)

Pontos onde ainda aparece marca da empresa de origem. Substituir por nome e paleta neutros:

- `index.html`: `<title>` e kicker do loader.
- `README.md`: título e primeiro parágrafo (deste repo já vem reescrito; conferir).
- `src/engine/scenes/HubScene.ts` (texto "SALÃO DE JOGOS") e `MenuScene.ts` (texto "TREINAMENTO").
- `src/engine/ui/BankMenu.ts`: `aria-label` do logo.
- `src/engine/config.ts`, `src/engine/ui/tokens.css`, `pixel.css`, `ranking.css`, `bank-menu.css`, `how-it-works.css`, `update-notice.css`, `scenes/BootScene.ts`: comentários e paleta. A paleta (preto quente, branco, um acento lima) é o tema atual: extrair para tokens e definir outra identidade.
- `public/favicon.svg`, `src/assets/*` e `public/assets/tiles/*`: conferir se algo é arte da marca. Kenney (`assets/vendor/kenney-rpg-urban-pack`) é CC0, pode ficar.
- `tests/unit/bank-menu.test.ts`, `tests/fixtures/fixtureContent.ts`: textos de teste.
- Depois: buscar por nomes de marca da origem e zerar o que sobrar (feito na fase 1).

Conteúdo de questões (`content/rooms/compliance/*`): são originais, escritos como inspirados em um tema de certificação, **sem trechos literais** do material de prova. Antes de publicar, revisar se o uso da sigla/nome da certificação em títulos de missão e arquivos (ex.: "Prova ABT1", `prova-abt1.json`, `simulado-abt1.json`) é aceitável, ou trocar por nomes genéricos. A sala `banking` está vazia (só `room.json`).

## 7. Segurança e privacidade (público aberto)

- Dados pessoais: e-mail e apelido. Escrever política de privacidade simples, oferecer **excluir conta** (apaga `auth.users` e cascata) e exportar dados.
- Não expor e-mail no ranking. Apelido único e moderável (campo `status` ou função de banimento por owner do grupo).
- Rate limit: ativar os limites do Supabase Auth, Turnstile no cadastro, e `CHECK`/funções que limitam partidas por usuário por dia.
- Convites: token longo aleatório, expiração curta por padrão, revogação pelo owner.
- Headers no Cloudflare Pages (`_headers`): CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`.
- O repositório pode ser público: nada de segredo versionado; `.env` ignorado; só a `anon key` vai no build.

## 8. Plano sugerido (fases)

1. **Base:** instalar dependências, rodar `npm test` e `npm run build` (devem passar como estão, offline). Neutralizar marca e nome do pacote.
2. **Supabase:** projeto novo, migrations (tabelas + RLS + funções), testes de política com dois usuários.
3. **Auth:** telas de login/cadastro/recuperação + Turnstile; sessão persistida; `SupabaseGameStore` com fila offline.
4. **Grupos:** criar grupo, convite por link, entrar, trocar de grupo, ranking por grupo/sala.
5. **Deploy:** Cloudflare Pages, variáveis `VITE_*`, CSP e headers, domínio.
6. **Fechamento:** política de privacidade, excluir conta, remover código do Apps Script e `remoteContent`.

## 9. Como verificar

- `npm test` (Vitest) e `npm run typecheck` verdes em cada fase.
- Teste de RLS: usuário A não lê linhas do B; usuário fora do grupo não lê o ranking do grupo; convite expirado ou esgotado falha.
- Com a rede cortada o jogo continua e a partida vai para a fila (`queued`), sincronizando depois.

## 10. O que NÃO veio para cá (de propósito)

`.planning/` (histórico do projeto de origem), `backend/` (Apps Script), `docs/DEPLOY.md`, `.clasp.json.example`, o CLAUDE.md original, scripts de planilha (`questions-sheet.mjs`, `inline-html.mjs`) e o teste do backend Apps Script.
