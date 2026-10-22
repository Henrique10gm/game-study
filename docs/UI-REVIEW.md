# Quest Hall — Revisão de UI (6 pilares)

**Data:** 2026-10-22
**Base de comparação:** padrões abstratos dos 6 pilares (não há UI-SPEC nem fase GSD)
**Capturas de tela:** não capturadas. O servidor de desenvolvimento não respondeu em `localhost:5173` (HTTP 000) e não tentei 3000 nem 8080. A auditoria é só de código e as razões de contraste foram calculadas por script (fórmula WCAG 2.x). Os pontos que dependem de ver a tela estão marcados como "verificar".
**Foco pedido:** beleza visual, paleta de cores e jornada do usuário. Visuals, Color e Experience Design têm mais peso nas conclusões.

---

## 1. Notas

| Pilar | Nota | Achado principal |
|---|---|---|
| 1. Copywriting | 3/4 | PT-BR específico e com tom coerente. Há uma frase de marca de empresa ("Faça Simples.") no código e dicas só de teclado exibidas também no celular. |
| 2. Visuals | 2/4 | O mundo pixel (rua, fachada, saguão) é a melhor parte do produto. Quem chega vê o login plano, sem logo e sem cena. Os cartões DOM cobrem quase todo o cenário dentro das salas. |
| 3. Color | 2/4 | Contraste de texto excelente. O acento lima faz 8 papéis ao mesmo tempo, não há cor semântica (erro, sucesso, aviso) e a paleta está duplicada e solta em ~25 pontos. |
| 4. Typography | 2/4 | Cerca de 13 tamanhos distintos. Os tokens de tipo quase não são usados e há texto de 11px dentro de um palco que é reduzido. |
| 5. Spacing | 3/4 | A escala de 4px existe e as telas DOM a usam. O BankMenu fixa valores fora da escala (10, 14, 18, 5, 6px). |
| 6. Experience Design | 3/4 | Estados de carregamento, erro, vazio e offline bem cobertos. As emendas da jornada são fracas (login, loader, aviso de novidades, ranking sem grupo). |

**Nota geral: 15/24**

### Top 3 correções

1. **Criar um sistema de cor semântico com fonte única** (Color e Visuals). Hoje o lima é CTA, link, sucesso, seleção, borda, número e janela de prédio. Erros do apelido saem em lima, igual ao sucesso (`ranking.css:48-54`). Criar `--color-danger`, `--color-success`, `--color-warning`, `--color-accent-hover`, `--color-accent-ink`, `--color-surface-raised` e `--color-line-strong`. Gerar a paleta Phaser (`COLORS`) a partir do mesmo arquivo e proteger com teste. Detalhes na seção 3.
2. **Fazer a primeira impressão ser a cena, não um cartão plano** (Visuals e Experience Design). O login (`auth.css:3-28`) é uma caixa cinza sobre fundo chapado, sem logo. O Phaser só nasce depois do login (`main.ts:54` antes de `main.ts:81`). A landing page com a rua e a fachada resolve isso, e o login deve aparecer na porta da fachada (seção 4).
3. **Tirar o aviso de novidades do caminho da primeira entrada** (Experience Design). Hoje o modal abre sobre a cena de entrada logo que o loader some (`App.ts:118-120`) e trava o teclado inteiro (`UpdateNotice.ts:68-75`). A primeira coisa que o jogador vê, depois do login, é um modal. Mostrar o aviso só depois do primeiro retorno ao saguão ou como um selo "Novidades" na barra.

---

## 2. Achados por pilar

### Pilar 1 — Copywriting (3/4)

Pontos fortes: CTAs específicos ("Escolher apelido", "Entrar no ranking", "Usar no ranking", "Bora jogar", "Voltar à sala"). Estados vazios explicam o que fazer (`RankingScreen.ts:71-72`, `GroupsScreen.ts:117`). Erros de autenticação são traduzidos (`AuthGate.ts:27-41`). Não encontrei "OK", "Submit" ou "Click here".

Problemas:

- **ATENÇÃO — marca de empresa em texto.** `MenuScene.ts:563` mostra 'Faça Simples.' ao clicar cinco vezes na placa, e o comentário em `:559` chama de "brand sign-off". O CLAUDE.md proíbe marca de empresa em texto, código ou assets. Trocar por uma frase neutra do próprio jogo. O easter egg do "nome do CEO" (`index.html:33`) segue a mesma linha e merece revisão.
- **ATENÇÃO — dica que não serve ao dispositivo.** `MenuScene.ts:333` mostra "← → andar / ↑ ou Enter entrar / Espaço pular" em qualquer aparelho. No celular não existe teclado, e o único gesto que funciona é tocar na tela (`MenuScene.ts:773-777`). `HubScene.ts:202` repete o problema ("↑ ou Enter"), embora ali o toque na porta funcione. Detectar entrada por toque (`matchMedia('(pointer: coarse)')`) e trocar para "Toque na tela para entrar".
- **Kicker inconsistente** para o mesmo lugar: 'QUEST HALL · TREINAMENTO' (`MenuScene.ts:253`), 'QUEST HALL · SALÃO DE JOGOS' (`HubScene.ts:195`), 'Quest Hall · Salão de Jogos' (`AuthGate.ts:113`, `index.html:19`). "Treinamento" é a única que remete a contexto corporativo. Padronizar.
- **Mensagem genérica de fallback**: `AuthGate.ts:40` "Não foi possível concluir. Tente de novo." e `GroupsScreen.ts:100`, `RankingScreen.ts:155`. Aceitável como último recurso, mas diga o que foi tentado (ex.: "Não foi possível entrar agora").
- **Termo "Hall da Fama" sem apresentação**: aparece como título do ranking e como cartão do menu, mas nunca é dito que "Hall da Fama = ranking do grupo". Um subtítulo curto resolve.
- Pequeno: o botão do login repete o título ("Entrar" no h1 e no botão, `AuthGate.ts:114,155`). Usar "Entrar na minha conta" ou "Acessar o salão".

### Pilar 2 — Visuals (2/4)

Pontos fortes: identidade pixel coerente (cantos em degrau via `clip-path`, bordas por `box-shadow`, `pixel.css:14-23`). O saguão e a fachada têm narrativa visual (portas por sala, placa, cone, gato). A barra segmentada `px-bar` é um bom detalhe. O favicon (`public/favicon.svg`) usa a mesma paleta.

Problemas:

- **BLOQUEADOR (primeira impressão): o login é o ponto mais fraco do produto.** `auth.css:3-28` é um cartão `#26211F` sobre `#1A1615`, centralizado, com um kicker de 12px. Sem logo, sem herói, sem cena. O loader que vem antes tem herói correndo e dicas (`boot-loader.css:50-101`), mas é escondido justamente quando o login aparece (`main.ts:53`). O usuário vê o herói animado, depois uma tela estática, depois a cena: ordem invertida de empolgação.
- **Tipografia de marca fraca**: o logotipo "quest**hall**" é só texto com dois pesos (`BankMenu.ts:96-111`, a própria nota diz "Swap for a logo SVG"). Não aparece no login nem no loader. O favicon é um círculo com "T" estilizado e não tem relação com o texto.
- **Cartões cobrem a cena**: dentro das salas, `.bank-panel`, `.bank-card` e `.bank-hall` usam `rgba(26,22,21,.97)` (`bank-menu.css:49,187,319`), ou seja, 97% opacos. O cenário bonito de `buildInside()` (`MenuScene.ts:426-482`) quase some. Verificar em tela: o herói, a moeda e o gato ficam numa faixa inferior estreita.
- **Dois idiomas visuais** convivem sem ponte: os cartões DOM são chapados e escuros, e a cena Phaser é colorida (verde-floresta, papel, petróleo). O cartão de sala parece "um app em cima de um jogo".
- **Sombra de profundidade invisível**: `pixel.css:22` desloca uma sombra `--color-forest` (#0F352B) sobre fundo #1A1615. Contraste de 1,34:1, então a "profundidade em verde floresta" descrita no comentário de `pixel.css:3` na prática não aparece.
- **Salas indistinguíveis**: `content/rooms/compliance/room.json` tem accent `#DBFFA5` e `banking/room.json` tem `#FCF8EC`. Em `HubScene.ts:255-268` o accent vira uma faixa de 6px e duas maçanetas de 3px. Duas portas quase idênticas. Verificar em tela.
- **Foco visual do saguão**: o prompt "↑ Entrar: {sala}" é texto de 13px sobre `#1A1615` (`HubScene.ts:86-97`). Pequeno para um momento-chave. O brilho da porta próxima é alpha 0,28 de uma cor já discreta.
- **Botões de ícone/controle**: "Sair" fixo (`auth.css:117-131`, 12px, 32px de altura) fica no canto inferior direito do `#ui-root` inteiro. Verificar em tela se colide com o "Segredos 0/10" desenhado no canto inferior direito do canvas (`MenuScene.ts:368`) em janelas com proporção próxima de 3:2.
- Acessibilidade do canvas: o jogo em Phaser não tem alternativa textual. Aceitável para um jogo, mas a landing precisará ter o conteúdo equivalente em HTML.

### Pilar 3 — Color (2/4)

Números (calculados): ver a tabela na seção 3. Resumo da paleta atual: texto branco sobre fundo 17,96:1; muted sobre superfície 5,94:1; lima sobre fundo 16,13:1; preto sobre lima 16,13:1; erro `#ff9c9c` sobre superfície 7,95:1. Todos passam AA e AAA com folga.

Problemas:

- **O acento faz coisa demais.** `var(--color-accent)` aparece 75 vezes em 15 arquivos CSS, mais 16 usos de `COLORS.lime` em TypeScript. Papéis: botão primário, link, foco, linha ativa, número de estatística, sucesso, janela de prédio, olho do gato, carros, confete, fita de obra, porta. Quando tudo é destaque, nada é. A regra 60/30/10 está violada no sentido inverso: o 10% virou 30%.
- **Sem cor semântica.** Só existe `#ff9c9c` para erro, e está hardcoded em dois lugares (`auth.css:87`, `groups.css:12`). Sucesso e aviso reutilizam o lima. **BLOQUEADOR parcial:** `ranking.css:48-54` pinta `.rank-form-message` sempre de lima, e essa mesma linha recebe mensagens de erro como "Esse apelido já está em uso" (`App.ts:63-68`). Erro e sucesso têm a mesma cor.
- **Tokens soltos fora de `tokens.css`**: `--color-forest`, `--color-moss`, `--color-wrong` estão em `pixel.css:8-10`. Em `bank-menu.css`, `#fff` literal em 6 pontos (linhas 23, 70, 96, 198, 209, 255) em vez de `--color-text`, e `rgba(255,255,255,.8)` em 165 e 224 (também `dialogue.css:269`). `rgba(26,22,21,*)` repete o `--color-bg` em 7 lugares (`bank-menu.css:49,147,187,319,406`, `how-it-works.css:11`, `update-notice.css:11`, `runner-controls.css:21`). `dialogue.css:313` usa `#36302d` e `:237` usa `rgba(255,255,255,.14)`.
- **Paleta duplicada em TypeScript**: `config.ts:22-34` (COLORS) repete os hex de `tokens.css`. Além disso: `0x100d0c` (estrada, sem nome) em `MenuScene.ts:325`, `HubScene.ts:275`, `PacmanScene.ts:154`; `'#1A1615'` em `HubScene.ts:92,207`, `main.ts:87`, `RunSceneBase.ts:15`, `cameoActor.ts:53`; `'#DBFFA5'` literal em `MenuScene.ts:188,204,563`, `RunSceneBase.ts:142,206`, `HubScene.ts:43`; `#2f6fdb` (azul) em `cameoActor.ts:19` e `avatar.ts:30`, fora da paleta neutra; `favicon.svg` repete moss e lima. Se a paleta mudar, são pelo menos 25 pontos para caçar.
- **Bordas e linhas fracas**: `--color-line` (`tokens.css:47`) dá 1,62:1 sobre o fundo. Os campos de formulário usam essa borda de 2px (`auth.css:64`, `menu.css:165`, `ranking.css:37`). A WCAG 1.4.11 pede 3:1 para o limite de um controle. Os campos de texto são difíceis de localizar. Alvo: 4,4 a 4,9:1 numa cor separada `--color-line-strong`.
- **Estado desabilitado**: `bank-menu.css:154-157` aplica `opacity: .5` sobre a linha, mas a linha desabilitada também recebe `.is-active` no hover (`BankMenu.ts:427`), virando um bloco lima a 50%. Verificar em tela.
- **Muted cinza neutro** (#9E9E9E) sobre superfície quente (#26211F) tem tom frio e brigam. Um cinza com leve calor assenta melhor.
- **Pontos positivos**: a nota "errado = cinza neutro, nunca vermelho" (`pixel.css:10`) é decisão deliberada de produto, só que hoje vira ausência de semântica no restante da UI. As cenas Phaser usam um conjunto coerente (forest, petrol, paper).

### Pilar 4 — Typography (2/4)

Distribuição medida nos CSS:

- **Tamanhos**: 11px (13 usos), 12px (11), 13 (6), 14 (6), 15 (5), 17 (1), 18 (4), 20 (2), 22 (2), 26 (6), 44 (1), mais os tokens 18, 14, 24 e 32. Cerca de 13 tamanhos distintos. O limite sensato é 5 a 6.
- **Pesos**: 800 (37), `var()` (29), 400 (8), 300 (8), 600 (5). Quatro pesos reais.
- Os tokens de papel tipográfico (`tokens.css:66-81`) existem, mas as telas novas usam tamanhos literais: 11px, 12px, 13px, 14px, 15px e 26px (`update-notice.css:44`, `how-it-works.css:42`, `bank-menu.css:67`).
- `menu.css:172-178` força `font-weight: 400` em títulos que o token define como 600 (`--type-heading-weight`, `--type-display-weight`). O token mente sobre o que renderiza.
- `menu.css:72` e `:75` declaram `font-weight` duas vezes no mesmo `.menu-btn` (800, depois `var(--type-label-weight)` = 600). O 800 é código morto.
- **Texto pequeno em palco reduzido**: o menu da sala é um palco de 960x640 escalado por `scale(...)` (`BankMenu.ts:303`) e só vira coluna normal abaixo de 0,72 (`:289`). A 0,72, um texto de 11px (`bank-menu.css:55-62` kicker; `:168-173` dica; `:212-217` subtítulo do cartão) renderiza com ~8px. Abaixo do confortável. Aplicar um piso: 12px no palco e 13px no corpo.
- Comentário desatualizado em `tokens.css:62` ("Inter self-hosted") mesmo usando Merriweather.
- Ponto positivo: a combinação serifada para títulos e sans para texto é boa e carrega personalidade. Fontes autohospedadas com `unicode-range` e `font-display: swap`. O número `bank-pct` (44px, serifada) é um bom momento de hierarquia.

### Pilar 5 — Spacing (3/4)

- Escala em múltiplos de 4 definida (`tokens.css:50-57`) e bem usada em auth, menu, ranking, grupos, avisos.
- `bank-menu.css` fixa literais fora da escala: 10px (6 ocorrências), 14px (4), 18px, 5px, 6px, 3px, 52px (`:402`). O padding do painel é `24px 24px 18px` (`:45`) e o do cartão é `16px 16px 14px` (`:182`), ritmos diferentes para o mesmo tipo de cartão.
- Margem de 4px (`--px`) usada como compensação das bordas externas do `px-box` (`menu.css:92`, `ranking.css:13,59`, `groups.css:9,31`). Funciona, mas tem de ser lembrada em cada componente novo. Uma classe `.px-box` que já inclua `margin: var(--px)` evita esquecimento.
- Valores de layout do palco em coordenadas fixas (`left: 252px`, `left: 722px`, `top: 324px`, `bank-menu.css:40,178,242`) acoplam o CSS à arte do cenário. É por isso que a fatia "compact" é uma segunda implementação (`:399-441`). Risco de manutenção.

### Pilar 6 — Experience Design (3/4)

Pontos fortes: carregamento (`bootLoader.ts`, usado em `App.ts:241,425,502`), erro de rede com queda para modo local (`App.ts:132-139`), estados de lista (carregando, erro, vazio, sozinho no ranking em `BankMenu.ts:175-205`), `aria-live` nas mensagens, Escape para voltar em todas as telas, dica de orientação para celular em pé (`orientationHint.ts`), `prefers-reduced-motion` em CSS (`pixel.css:74-79`, `boot-loader.css:188`), alvo de toque de 44px (`--touch-min`), convite por link guardado antes do login (`main.ts:45`).

Problemas na jornada (detalhes na seção 4):

- **O aviso de novidades abre por cima da primeira cena** (`App.ts:118-120`, `:124-129`), com `keydown` em captura que engole todas as teclas menos Tab (`UpdateNotice.ts:68-75`). O jogador faz login, vê o loader e a rua por 300ms, e já cai num modal. O texto do botão ("Bora jogar") também promete jogar, mas o clique só devolve uma rua.
- **O loader some antes do login e volta depois** (`main.ts:53` e `:60`). A tela de carregamento com herói correndo desaparece para dar lugar a uma tela estática. A transição loader, auth, loader, cena tem três fades diferentes.
- **Ranking sem grupo é um beco**: `RankingScreen.ts:65-74` mostra só um parágrafo e o botão "Grupos" no estilo secundário, igual a "Voltar à sala" (`:82`, mesma classe `menu-btn--secondary`). Não há botão primário "Criar grupo" nem "Entrar com convite" direto. O mesmo vale para o cartão "Hall da Fama" do menu (`BankMenu.ts:170-172`): "Disponível com uma conta e um grupo (veja a tela de ranking)" não leva ninguém a lugar nenhum, e o botão só aparece quando há lista.
- **Botões sem estado de hover/foco próprio**: `.menu-btn` (`menu.css:65-82`) não tem `:hover` nem `:focus-visible` (só 10 regras de foco no projeto inteiro, nenhuma em `.menu-btn`, `.auth-input`, `.auth-link`, `.hiw-btn`, `.upd-btn`). Depende do contorno padrão do navegador, que no fundo escuro e com `outline` ocasionalmente zerado (`bank-menu.css:134`) pode ficar invisível. Usuários de teclado são o público principal do jogo.
- **Hover = seleção** no menu da sala (`BankMenu.ts:427`): o mouse passando muda a linha ativa e o painel de detalhes. Bom para descoberta, ruim para quem só atravessa o cursor.
- **Login**: sem botão "mostrar senha"; o botão de envio fica desabilitado a 60% de opacidade com cursor `wait` (`auth.css:94-97`), mas sem texto como "Entrando…". O foco vai para o primeiro `input` (`AuthGate.ts:101`), correto.
- **Toque**: no celular, a rua não tem controles na tela; só o toque em qualquer lugar entra (`MenuScene.ts:773-777`). O jogador nunca "anda", perdendo o momento de brincar com o cenário. Verificar em tela.
- **Sair** reinicia a página sem confirmação (`AuthGate.ts:267`). Aceitável porque o progresso é salvo, mas o botão fica sempre visível, até durante a corrida (verificar).
- `prefers-reduced-motion` só existe se `pixel.css` tiver sido carregado (importado por Ranking, Grupos e avisos), e o canvas Phaser (tweens, fade de câmera, parallax do herói) não respeita a preferência.

---

## 3. Paleta

### 3.1 Diagnóstico da paleta atual

**O que funciona**
- Preto quente `#1A1615` com superfície `#26211F` é uma base agradável e menos fria que o preto puro. A temperatura combina com o papel `#FCF8EC` da fachada.
- Contraste de texto muito alto. Nenhum par principal falha AA.
- O lima `#DBFFA5` é memorável, legível sobre o escuro e dá uma identidade neutra e reconhecível. A decisão de "acento único" é boa em princípio.
- As cores de cena (forest `#0F352B`, petrol `#243833`, papel) criam um céu noturno verde e uma fachada de pedra off-white coerentes.

**O que cansa**
- **Branco puro `#FFFFFF` sobre preto quente** (17,96:1) vibra em leituras longas e em blocos como `.bank-detail` e `.upd-list`. Um branco quente (tipo papel) reduz o brilho sem perder contraste.
- **O lima faz papéis demais** (seção Color). Sem cores de apoio, o olho não distingue o que é ação do que é informação.
- **Janelas acesas em lima** (`BootScene.ts:107`, `MenuScene.ts:290-293` usa papel; skyline usa lima 55%). Lima neon em janela de prédio soa "ficção científica", não "cidade à noite". Âmbar quente é mais crível e libera o lima para a interface.
- **Cinza neutro `#9E9E9E`** sobre superfície quente ganha um tom frio e levemente desbotado. Um muted com calor assenta melhor.
- **Linhas a 16% de branco** (1,6:1) somem. Os cartões se separam do fundo por diferença de 1,1:1 entre `#1A1615` e `#26211F`, ou seja, quase nenhuma. Falta um degrau de superfície elevada.
- **Estrada `0x100d0c` e contornos da cena** são "mais escuros que o fundo" sem nome nem papel.

**Contraste da paleta atual (calculado)**

| Par | Razão | Veredito |
|---|---|---|
| Branco / fundo `#1A1615` | 17,96:1 | AAA |
| Branco / superfície `#26211F` | 15,91:1 | AAA |
| Muted `#9E9E9E` / fundo | 6,70:1 | AA |
| Muted / superfície | 5,94:1 | AA |
| Lima / fundo | 16,13:1 | AAA |
| Lima / superfície | 14,29:1 | AAA |
| Texto escuro (#1A1615) / lima (botão) | 16,13:1 | AAA |
| Erro `#ff9c9c` / superfície | 7,95:1 | AAA |
| Linha (branco 16%) / superfície | 1,68:1 | falha para borda de campo (alvo 3:1) |
| Linha / fundo | 1,62:1 | idem |
| Barra vazia `px-bar` (branco 14%) / superfície | 1,55:1 | falha para elemento informativo |
| Sombra forest `#0F352B` / fundo | 1,34:1 | praticamente invisível |
| Lima / forest (janela, prédio) | 12,06:1 | ok |
| Papel / petrol (fachada, céu) | 11,71:1 | ok |
| Cinza escuro `#666` / fundo (gato, poste) | 3,13:1 | só decorativo, ok |
| Muted / petrol (texto Phaser sobre o céu) | 4,64:1 | limítrofe para 12px |
| Linha ativa desabilitada (lima a 50%) | não medido | verificar em tela |

**Uso do acento**: 75 ocorrências em CSS, 16 em TS. Recomendação: reservar o lima para (1) ação primária, (2) item ativo e (3) progresso. Link, sucesso, número de estatística e foco passam a usar outras cores ou o texto normal.

### 3.2 Proposta — duas opções

Ambas mantêm a identidade neutra (sem marca de empresa), o clima noturno pixel e adicionam: degrau de superfície elevada, linha forte para controles, acento com hover e tinta, e cores semânticas separadas do acento. Contrastes calculados (texto 4,5:1, não-texto 3:1).

#### Opção A — "Lima Noturna" (evolução, mantém a identidade atual)

Menor risco: a mesma ideia, mais refinada. O lima fica um pouco menos neon e a luz das janelas vira âmbar.

| Token | Hex | Papel e contraste |
|---|---|---|
| `--color-bg` | `#151211` | Fundo. Branco quente sobre ele: 16,53:1 |
| `--color-surface` | `#201B19` | Cartões. Texto 15,11:1 |
| `--color-surface-raised` | `#2B2522` | Hover, campo ativo, cartão elevado. Texto 13,39:1 |
| `--color-line` | `#3A332F` | Divisória decorativa |
| `--color-line-strong` | `#8B8178` | Borda de campo e controle. 4,89:1 sobre bg, 4,47:1 sobre surface |
| `--color-text` | `#F6F1E4` | Texto principal (branco quente) |
| `--color-muted` | `#B3ABA0` | Texto secundário. 8,21:1 sobre bg, 7,51:1 sobre surface, 6,65:1 sobre raised |
| `--color-accent` | `#D2F58C` | Ação primária. 15,25:1 sobre bg |
| `--color-accent-hover` | `#E6FFB4` | Hover do botão. Tinta sobre ele: 17,16:1 |
| `--color-accent-ink` | `#151211` | Texto sobre o acento. 15,25:1 |
| `--color-danger` | `#FF8F80` | Erro. 7,70:1 sobre surface |
| `--color-success` | `#7FD8A6` | Sucesso (menta, distinta do lima). 9,96:1 sobre surface |
| `--color-warning` | `#F2C25B` | Aviso. 10,26:1 sobre surface |
| `--scene-sky-top` | `#151211` | Céu em cima (igual ao bg, a rua "continua" a página) |
| `--scene-sky-bottom` | `#1F3B35` | Céu perto do horizonte |
| `--scene-building` | `#10302A` | Prédios ao fundo. Janela âmbar `#F2C25B` sobre ele: 8,55:1 |
| `--scene-facade` | `#EFE6D2` | Fachada de pedra. 9,75:1 sobre o céu baixo |

Notas: `scene-window` = `--color-warning` (mesma cor), assim a luz da cidade e o aviso da interface falam a mesma língua. A `--color-line` decorativa pode ficar fraca; o que precisa de 3:1 passa a usar `line-strong`.

#### Opção B — "Âmbar e Petróleo" (mais noturna, muda o acento)

Mais "cidade à noite": fundo com um sopro azul-petróleo (combina com o céu petróleo já existente), acento âmbar quente (luz de poste e janela). Perde o lima que é a assinatura atual. Só vale se a decisão for repensar a identidade junto com a landing.

| Token | Hex | Papel e contraste |
|---|---|---|
| `--color-bg` | `#12171A` | Fundo. Texto 16,00:1 |
| `--color-surface` | `#1B2227` | Cartões. Texto 14,27:1 |
| `--color-surface-raised` | `#252E34` | Elevado. Texto 12,26:1 |
| `--color-line` | `#2F3A42` | Divisória |
| `--color-line-strong` | `#6F8089` | Borda de controle. 4,41:1 sobre bg, 3,93:1 sobre surface |
| `--color-text` | `#F4F1EA` | Texto |
| `--color-muted` | `#A7B2B8` | 8,34:1 sobre bg, 7,44:1 sobre surface, 6,39:1 sobre raised |
| `--color-accent` | `#FFC857` | Ação primária. 11,74:1 sobre bg |
| `--color-accent-hover` | `#FFD98A` | Tinta sobre ele: 13,36:1 |
| `--color-accent-ink` | `#12171A` | Texto sobre o acento. 11,74:1 |
| `--color-danger` | `#FF7F73` | 6,54:1 sobre surface |
| `--color-success` | `#6FD6A2` | 9,06:1 sobre surface |
| `--color-warning` | `#F59E5B` | 7,61:1 sobre surface. Atenção: próximo do acento; usar sempre com ícone |
| `--scene-sky-top` | `#0E1418` | Céu em cima |
| `--scene-sky-bottom` | `#1B3B4C` | Horizonte |
| `--scene-building` | `#14303A` | Prédios. Janela `#FFC857` sobre ele: 9,02:1 |
| `--scene-facade` | `#EBE1CA` | Fachada. 9,09:1 sobre o horizonte |

**Recomendação:** a Opção A. Preserva a assinatura lima, o menor número de mudanças visuais para quem já joga, e resolve os problemas reais (semântica, linha de controle, janelas). A Opção B só se a landing for ocasião para um reposicionamento visual completo.

### 3.3 Como migrar (fonte única de verdade)

Hoje `tokens.css` (CSS) e `config.ts` `COLORS` (Phaser) são cópias manuais, e há mais ~25 pontos soltos. Passos:

1. **Um arquivo de paleta em TS** (`src/engine/palette.ts`) com os hex em string (`'#D2F58C'`). Dele sai `COLORS` numérico (`parseInt(hex.slice(1), 16)`), que substitui o objeto de `config.ts:22-34`. Os nomes novos (`surfaceRaised`, `lineStrong`, `danger`, `success`, `warning`, `sceneSkyTop`, `sceneSkyBottom`, `sceneBuilding`, `sceneFacade`, `sceneRoad`) entram aqui.
2. **`tokens.css` continua com os mesmos nomes**, porque o loader em `index.html` precisa de cor antes de qualquer JavaScript. O elo é um **teste Vitest** que lê `tokens.css`, extrai `--color-*` e compara com `palette.ts`. Se alguém alterar um lado, o `npm test` quebra. Mais barato e mais seguro do que gerar arquivos.
3. **Mover para `tokens.css`** o que está solto em `pixel.css:8-10` (`forest`, `moss`, `wrong`) e criar `--color-text-dim` (substitui `rgba(255,255,255,.8)`, `bank-menu.css:165,224`, `dialogue.css:269`) e `--color-bg-overlay` (substitui os 7 `rgba(26,22,21,*)`). Trocar `#fff` por `var(--color-text)` em `bank-menu.css` (6 pontos).
4. **Trocar literais em TS** por `COLORS`/`css(COLORS.x)`: `'#DBFFA5'` (`MenuScene.ts:188,204,563`, `RunSceneBase.ts:142,206`, `HubScene.ts:43`), `'#1A1615'` (`HubScene.ts:92,207`, `main.ts:87`, `RunSceneBase.ts:15`, `cameoActor.ts:53`), `0x100d0c` (viram `COLORS.sceneRoad`). Decidir o azul `#2f6fdb` de `cameoActor.ts:19` e `avatar.ts:30`: ou entra na paleta como "cor de personagem" nomeada, ou vira `--color-accent`.
5. **Semântica**: `.auth-message`, `.grp-message` e `.rank-form-message` passam a ter `.is-error` (danger) e `.is-ok` (success). Corrigir `ranking.css:48-54` na mesma mudança, e o código que preenche a mensagem (`RankingScreen.ts:145-157`) para marcar a classe.
6. **Bordas de controle**: `.auth-input`, `.menu-input`, `.rank-input` e `.px-bar` vazia usam `line-strong`. Foco: `outline: 2px solid var(--color-accent); outline-offset: 2px` em `.menu-btn`, `.auth-input`, `.auth-link`, `.hiw-btn`, `.upd-btn`.
7. **Conteúdo**: `content/rooms/*/room.json` guarda `accent`; passar a aceitar um nome de token ("accent", "paper") ou garantir por teste que o hex pertence à paleta. Dar a cada sala um acento distinto (hoje lima e papel quase iguais).
8. **Assets**: gerar `favicon.svg` a partir da paleta (ou comentar a dependência), e atualizar `<meta name="theme-color">` (hoje inexistente em `index.html`).
9. **Ordem sugerida**: (a) tokens novos sem mudar valores, (b) trocar literais, (c) só então trocar os valores para a Opção A. A etapa (c) é uma mudança de uma linha por token, com revisão visual das cenas.

---

## 4. Jornada

### 4.1 Mapa da jornada atual e atritos

| # | Etapa | Onde está no código | Atrito |
|---|---|---|---|
| 1 | Carregando (herói corre, dicas) | `index.html:17-36`, `boot-loader.css` | Bem feito, mas é escondido antes do login (`main.ts:53`). Dura pouco em conexão boa e some justo quando seria útil. |
| 2 | Login | `AuthGate.ts`, `auth.css` | Tela chapada sem marca, sem cena, sem explicar o que é o jogo antes de pedir e-mail e senha. Quem chega por indicação não sabe o que está criando. Captcha e confirmação de e-mail estão bem tratados no texto. |
| 3 | Loader de novo | `main.ts:60` | Três fades seguidos (auth, loader, cena). |
| 4 | Aviso de novidades | `App.ts:118-129` | Modal sobre a primeira cena. Quem acabou de criar a conta lê "o que há de novo" de um jogo que não conhece. |
| 5 | Rua e fachada (MenuScene) | `MenuScene.ts:268-378` | O melhor momento visual, mas mostra dicas de teclado no celular e o fade para o saguão leva 300ms + 500ms de herói sumindo. |
| 6 | Saguão | `HubScene.ts` | Portas pouco distintas entre salas (accent de 6px). |
| 7 | Sala (menu) | `BankMenu.ts` | Cartões 97% opacos escondem a cena; 11px escalados. Hover muda a seleção. |
| 8 | Modo, estilo, tamanho | `BankMenu.showStyles/showSizes` | Três menus em sequência no mesmo cartão. Falta indicação de passo ("2 de 3"). |
| 9 | Corrida, partida | `RunFlow`, cenas | Fora do escopo desta revisão (só CSS de HUD lido de relance). |
| 10 | Revisão e relatório | `review.css`, `report.css` | Fora do escopo detalhado. |
| 11 | Ranking | `RankingScreen.ts` | Sem grupo, beco (seção Experience). Erro do apelido em lima. |
| 12 | Grupos | `GroupsScreen.ts` | Fluxo de criar e entrar completo, mas só se alcança pelo ranking. Convite por link foi tratado corretamente (`main.ts:45`, `:69-76`). |

**Resumo dos pontos de quebra:** (a) troca brusca de "página estática de login" para "mundo pixel"; (b) loader escondido onde faria sentido; (c) modal logo na chegada; (d) ranking e grupos como becos para quem ainda não tem grupo; (e) experiência de toque sem andar.

### 4.2 Jornada proposta com landing page

```
Landing (rolagem) -> chegada à rua e fachada -> "Entrar" na porta -> login em cima da cena
  -> herói entra pela porta -> saguão -> sala -> ...
Quem já tem sessão: Landing curta com "Jogar" -> rua -> porta -> saguão (sem login)
```

#### Navbar: Produto | Quem somos | Entrar

- **Estrutura:** `<header><nav aria-label="Principal">` com a marca "quest**hall**" à esquerda (mesmo wordmark do jogo), links **Produto** e **Quem somos** (âncoras `#produto`, `#quem-somos`) e **Entrar** como botão com `--color-accent` à direita. Entrar é o único elemento em destaque.
- **Estado ao rolar:** transparente sobre o herói; depois de ~64px de rolagem ganha fundo `--color-bg` a 90% com desfoque e uma linha `--color-line` de 1px embaixo. Link da seção visível fica sublinhado (scroll-spy com `aria-current="true"`). Na seção final da rua, a navbar fica transparente de novo e some o link ativo, para não competir com a cena.
- **Mobile (< 720px):** a marca e o botão **Entrar** continuam visíveis na barra (não escondidos no menu). Produto e Quem somos vão para um botão "Menu" que abre uma folha de tela cheia com três itens de 48px de altura. `aria-expanded`, foco preso dentro da folha, Esc fecha. Alvos de 44px mínimos, como já exige `--touch-min`.
- **Âncoras:** `scroll-margin-top` igual à altura da barra e `scroll-behavior: smooth` somente fora de `prefers-reduced-motion`.

#### Sequência de seções ao rolar (6)

1. **Abertura (hero)** — "Estudar também pode ser um jogo." Subtítulo de uma linha ("Missões curtas, ranking com seu grupo e a sua preparação sempre à vista."). Botões **Começar** e **Ver como funciona**. Fundo: o céu noturno e o skyline em parallax suave. Propósito: dizer o que é em 5 segundos.
2. **Produto: como funciona** (`#produto`) — "Três passos, sem cadastro longo". 1) Escolha uma sala; 2) jogue uma missão; 3) veja sua preparação subir. Três cartões pixel com capturas do menu e do cartão de preparação. Propósito: tirar a dúvida "isso é um quiz?".
3. **Modos de jogo** — "Escolha como estudar". Os quatro modos (Desvie do obstáculo, Contra o tempo, Corrida, Pac-man) com um loop curto de sprite em CSS (`steps()`), cada um com uma frase. Propósito: mostrar a variedade e dar ao visitante um gosto do jogo sem carregar o Phaser.
4. **Progresso e grupos** — "Compita com quem você conhece". Ranking por grupo, convite por link, nível, ofensiva diária. Linha de privacidade clara: "Seu e-mail nunca aparece no ranking" (já está dita em `AuthGate.ts:146`). Propósito: explicar o motivo do cadastro antes de pedi-lo.
5. **Quem somos** (`#quem-somos`) — texto curto e honesto sobre quem faz e por quê, em tom neutro, sem marca de empresa (conforme o CLAUDE.md). Propósito: confiança.
6. **A rua e a fachada** (cena final, fixa na tela) — nenhum texto grande. O céu escurece, a rua aparece, o herói anda até a porta, e aparece o aviso "Entrar" na porta. É a seção que dá a sensação de "já estou dentro do jogo".

#### Transição final até a cena do banco

Meta: o último quadro da landing deve ser **pixel-idêntico** ao primeiro quadro de `MenuScene` (fase `outside`) e a passagem para o jogo real, sem corte visível.

**Fatos do código que condicionam a solução**
- A rua é desenhada por código em `MenuScene.ts:268-330`, mas **não é determinística**: estrelas e janelas usam `Phaser.Math.Between` (`:283,287,288`) e `Math.random` (`:293`). Cada visita sorteia um skyline diferente. Para a landing igualar o jogo é preciso uma semente fixa (ou assar a imagem).
- O Phaser só é criado **depois** do login (`main.ts:81`) e tem backgroundColor `#1A1615` (`main.ts:87`), com `Scale.FIT` e `CENTER_BOTH` (`:94-97`): o canvas tem barras laterais em telas fora de 3:2.
- `#app` tem `overflow: hidden`, `height: 100dvh` e `user-select: none` (`tokens.css:95-105`), e `html, body` têm `overscroll-behavior: none` (`:92`): a landing não pode viver dentro de `#app`.

**Três abordagens**

| | A. Camadas estáticas + rolagem CSS, com troca para o Phaser no fim (recomendada) | B. A própria cena Phaser na landing, guiada pela rolagem | C. Canvas 2D/SVG reimplementando a rua |
|---|---|---|---|
| Como | Gerar a rua em camadas PNG/WebP (céu, skyline, fachada, calçada/estrada, herói) com uma semente fixa. A landing as move com `position: sticky` + `animation-timeline: scroll()` e `transform`. Perto do fim, pré-carregar o chunk do Phaser; quando o herói chega à porta, o canvas já criado atrás assume com um fade de 150ms. | Subir o Phaser na landing e uma `LandingScene` ligada ao `window.scrollY` (câmera e herói). | Reescrever `buildOutside` em Canvas 2D ou SVG para usar na landing; manter o Phaser só no jogo. |
| Fidelidade com o jogo | Alta se as camadas forem geradas pelo próprio `buildOutside` com a mesma semente (script de build ou `generateTexture` + `toDataURL` uma vez). | Total (é a mesma cena). | Média: duas implementações a manter em sincronia; qualquer retoque na rua precisa ser feito duas vezes. |
| Desempenho | Bom. Imagens pequenas (960x640 ampliadas com `image-rendering: pixelated`), sem JavaScript pesado na rolagem. O chunk do Phaser baixa em ocioso. | Pior no primeiro carregamento (o bundle do Phaser pesa a maior parte do site) e na rolagem em celulares fracos. | Bom na execução, caro de construir. |
| Acessibilidade | Cenário decorativo `aria-hidden="true"`; todo o texto está em HTML real. | O canvas é opaco para leitores de tela; ainda seria preciso duplicar o texto em HTML. | Igual à A. |
| SEO | Conteúdo em HTML estático: bom. | Se o texto for HTML ao lado, igual; se for desenhado no canvas, péssimo. | Bom. |
| `prefers-reduced-motion` | Sem parallax e sem caminhada: mostra o quadro final estático com o botão Entrar visível. Troca por fade simples ao entrar. | O Phaser não obedece por conta própria; é preciso tratar na cena. | Fácil. |
| Esforço | M | G | G |

**Receita da abordagem A (passo a passo)**
1. **Fonte única da rua:** extrair `drawStreet(g, rng)` de `MenuScene.buildOutside` (`:268-330`) para um módulo, recebendo um gerador pseudoaleatório com semente. `MenuScene` o usa com semente fixa; um script (Node/Playwright em modo headless, ou uma página de dev) exporta as camadas para `public/landing/`. Isso garante "pixel-idêntico" por construção.
2. **Mesma moldura do canvas:** a seção final é um palco 960x640 centralizado e escalado por `min(100vw/960, 100dvh/640)`, sobre `--color-bg`. É a mesma regra do `Scale.FIT`; o que sobra fora do palco já é a cor `#1A1615` do canvas. Sem salto ao trocar.
3. **Rolagem:** uma faixa de ~250 a 300vh com um palco `position: sticky; top: 0`. O progresso (0 a 1) move o céu (0,2x), o skyline (0,5x), a fachada (1x) e o herói andando da esquerda até a porta em `x = 640` (o mesmo `DOOR_X` de `MenuScene.ts:42`). Usar rolagem nativa (nunca interceptar a roda do mouse, para não prender o usuário).
4. **Estado final:** o herói de costas à porta (mesmo frame `heroIdleFrame('back')` usado em `MenuScene.ts:649`), a lâmpada acesa, o prompt "Entrar" e a hora de login.
5. **Pré-carga:** ao passar de ~60% da faixa, `import('phaser')` e a criação do `Phaser.Game` com `MenuScene` em modo `intro` já na posição final. O canvas fica por trás e a camada estática por cima. Quando `assets-ready` chega, o fade de 150ms revela o canvas idêntico.
6. **Para quem já tem sessão:** não rolar tudo. Mostrar o botão "Jogar" já na navbar, que leva direto ao fim da faixa (ou pula para a rua e o herói caminhando até a porta).
7. **Portas laterais:** a janela do poste (`MenuScene.ts:329-330`), o brilho e o carro são extras; deixar o carro e a estrela cadente fora da camada estática (ou animá-los em CSS por `prefers-reduced-motion`).

**Cuidados**
- **Rolagem com `animation-timeline`:** o suporte ainda varia entre navegadores (verificar a tabela de compatibilidade atual antes de decidir). Usar `@supports (animation-timeline: scroll())` e um fallback com `IntersectionObserver` + `requestAnimationFrame` para o resto.
- **Landing não pode quebrar os retornos do Supabase.** `AuthGate.ts:230` e `:239` usam `window.location.origin` como destino do e-mail de confirmação e de recuperação de senha, e `captureInviteFromUrl` (`main.ts:45`) lê o convite da URL. Se `/` virar landing, ela precisa detectar esses parâmetros (hash de sessão, `?code`, convite) e pular direto para o login ou o jogo, ou os destinos precisam apontar para `/jogar`.
- **Carregamento:** a landing deve ser um HTML estático próprio (pré-renderizado), com `<title>`, `<meta name="description">`, Open Graph e `theme-color`, que hoje não existem em `index.html`. O CSP atual (`index.html:6-9`) já serve a landing (tudo autohospedado).
- **Scrolljacking:** não reter o scroll; a faixa fixa só estica a página. Garantir que o teclado (Tab, setas, Page Down, End) cheguem ao botão Entrar.
- **Uma versão sem JavaScript:** o HTML da landing deve mostrar o texto e um link "Entrar" mesmo sem JS. A cena é decoração.

#### Como o botão "Entrar" leva ao login sem quebra

1. **Cliques em Entrar na navbar** rolam suavemente até o fim da faixa (ou, em reduced motion, saltam direto). Ao chegar, a cena para na porta.
2. **O login aparece na porta**, não numa tela separada: o cartão `auth-card` (hoje `auth-screen`, `auth.css:3-28`) é montado sobre a cena com um véu `--color-bg` a ~60%, mantendo a fachada visível atrás. Reaproveitar `AuthGate` (apenas `.auth-screen` com fundo translúcido), sem mudar a lógica de autenticação.
3. **Foco e rótulo:** o foco vai ao e-mail (`AuthGate.ts:101` já faz isso); o diálogo mantém `role="dialog"` e ganha `aria-modal`. Esc fecha o login e devolve o foco ao botão Entrar.
4. **Sucesso:** em vez do corte atual (remove o cartão, mostra o loader, depois a cena), o herói **anda até a porta e entra**, reaproveitando `enterBank()` de `MenuScene.ts:636-663`, e então o fade leva ao saguão. O loader só aparece se o carregamento passar de ~400ms.
5. **Aviso de novidades:** sai da chegada. Entra como o selo "Novidades" na navbar da landing e no cabeçalho do saguão, abrindo o mesmo cartão sob demanda; ou aparece uma única vez na segunda visita ao saguão.
6. **Fallbacks:** se o Supabase não estiver configurado (`createSupabase()` retorna nulo), o botão passa a se chamar "Jogar" e leva direto à porta.
7. **Convite por link:** quem chega com `?convite=` vê a landing normalmente, mas o botão Entrar abre o login com um aviso curto ("Você foi convidado para um grupo") e o código continua guardado como hoje.

---

## 5. Mudanças priorizadas

Esforço: P = até meio dia, M = 1 a 3 dias, G = mais de 3 dias.

### P0 — fazer antes de qualquer mudança visual maior

| # | Mudança | Esforço |
|---|---|---|
| 1 | Corrigir a cor das mensagens: classes `.is-error`/`.is-ok` com `--color-danger`/`--color-success` em `ranking.css`, `auth.css`, `groups.css`; marcar a classe em `RankingScreen.ts` | P |
| 2 | Trocar 'Faça Simples.' (`MenuScene.ts:563`) por uma frase neutra e revisar os easter eggs que citam empresa/CEO | P |
| 3 | Adicionar `:focus-visible` e `:hover` a `.menu-btn`, `.auth-input`, `.auth-link`, `.hiw-btn`, `.upd-btn`, `.rank-input` | P |
| 4 | Mover o aviso de novidades para fora da chegada (selo "Novidades" ou segunda visita ao saguão) | P |
| 5 | Dicas de teclado condicionais a `(pointer: coarse)` em `MenuScene.ts:333` e `HubScene.ts:202` | P |
| 6 | Piso tipográfico (12px no palco, 13px no corpo) em `bank-menu.css` | P |

### P1 — paleta e consistência

| # | Mudança | Esforço |
|---|---|---|
| 7 | Criar `palette.ts` como fonte única, gerar `COLORS`, teste Vitest comparando com `tokens.css` | M |
| 8 | Adicionar os tokens novos (surface-raised, line-strong, accent-hover, accent-ink, danger, success, warning, text-dim, bg-overlay, scene-*) e substituir os literais em CSS (`#fff`, `rgba(26,22,21,*)`, `rgba(255,255,255,.8)`, `#36302d`) | M |
| 9 | Aplicar a Opção A (valores novos), com revisão visual das cenas e do favicon | M |
| 10 | Janelas dos prédios em âmbar (`BootScene.ts:107`, `MenuScene.ts:290`) e acento distinto por sala (`room.json`) | P |
| 11 | Reduzir o lima a ação primária, item ativo e progresso; revisar os 75 usos | M |
| 12 | Borda de campo com `line-strong` (3:1) e barra vazia mais visível | P |
| 13 | Reduzir a escala tipográfica para ~6 tamanhos, usar os tokens e corrigir o `font-weight` morto (`menu.css:72`, `:172-178`) | M |
| 14 | Ranking e cartão "Hall da Fama" sem grupo: botão primário "Criar grupo" e "Entrar com convite" | P |
| 15 | Alinhar o espaçamento do BankMenu à escala de 4px | P |
| 16 | `prefers-reduced-motion` global em `tokens.css` e tratamento no Phaser (sem tweens decorativos, fade curto) | M |

### P2 — a landing e a transição contínua

| # | Mudança | Esforço |
|---|---|---|
| 17 | Extrair `drawStreet(g, rng)` determinístico da `MenuScene` e gerar as camadas da rua | M |
| 18 | Landing estática (navbar, 5 seções de texto, metas de SEO), em página própria, tratando os retornos do Supabase e convites | G |
| 19 | Seção final de rolagem com parallax e herói até a porta (abordagem A), com fallback sem `animation-timeline` e versão estática em reduced motion | G |
| 20 | Login montado sobre a cena na porta; sucesso reaproveita `enterBank()` | M |
| 21 | Pré-carga do chunk do Phaser a ~60% da rolagem e troca por fade de 150ms | M |
| 22 | Cartões do menu da sala mais translúcidos ou menores, deixando a cena respirar; indicador de passo "2 de 3" nos três menus em sequência | M |
| 23 | Logotipo/marca em SVG pixel (substituir o texto em `BankMenu.ts:96`) e favicon coerente | M |
| 24 | Controles na tela para a rua e o saguão no toque (setas e botão de entrar) | M |

---

## Arquivos auditados

CSS: `src/engine/ui/tokens.css`, `pixel.css`, `menu.css`, `bank-menu.css`, `ranking.css`, `groups.css`, `how-it-works.css`, `update-notice.css`, `boot-loader.css`, `src/auth/auth.css`. Lidos por grep (cores, tamanhos, espaçamentos, foco): `hud.css`, `dialogue.css`, `review.css`, `report.css`, `runner-controls.css`, `orientation-hint.css`.

TypeScript: `src/auth/AuthGate.ts`, `src/app/App.ts`, `src/main.ts`, `src/engine/config.ts`, `src/engine/scenes/MenuScene.ts`, `HubScene.ts`, `BootScene.ts` (até a linha 200), `src/engine/ui/BankMenu.ts`, `RankingScreen.ts`, `GroupsScreen.ts` (até a linha 140), `HowItWorks.ts`, `UpdateNotice.ts`, `bootLoader.ts`, `orientationHint.ts`. Lidos por grep: `cameoActor.ts`, `avatar.ts`, `RunSceneBase.ts`, `PacmanScene.ts`, `styles.ts`.

Outros: `index.html`, `public/favicon.svg`, `content/rooms/*/room.json` (campo `accent`).

Não revisados em detalhe: `FlappyScene`, `RunnerScene`, `TimeAttackScene`, `PacmanScene`, HUD, diálogo, revisão e relatório (só cores e tamanhos por grep).

**Auditoria de registro (shadcn):** não aplicável (não há `components.json`).

## UI REVIEW COMPLETE
