# StudyGarage

Salão de jogos de estudo no navegador. O personagem anda por um saguão com uma porta por **sala** (tema); cada sala tem missões, perfil e ranking próprios. A cada 5 barreiras o jogo pausa e faz uma questão; 3 vidas; no fim, revisão dos erros.

Estado: funciona offline (progresso no `localStorage`). Em migração para Supabase + Cloudflare Pages. Veja [`HANDOFF.md`](./HANDOFF.md).

## Rodar

1. `npm install`
2. `npm run dev`
3. `npm test`
4. `npm run build` (saída em `dist/`)

## Estrutura

- `src/engine/`: motor do jogo, cenas Phaser e telas DOM.
- `src/state/`: persistência (`GameStore` e implementações).
- `content/rooms/<sala>/`: `room.json` e `questions/*.json`.
- `public/assets/`, `assets/`: pixel art CC0 (Kenney) e fonte Inter.
