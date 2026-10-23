# Revisão da landing: texto, nome, seletor de certificação e continuidade com o jogo

**Data:** 2026-10-22
**Escopo:** leitura do código (sem execução, sem capturas de tela). Nada foi alterado em `src/`, `tests/`, `index.html` ou `public/`. Este arquivo é o único produto desta revisão.
**Como ler:** a seção 1 resume. As seções 2 a 4 são o material pronto para colar. A seção 5 explica o problema de "o jogo parece outro produto". A seção 6 é a lista de execução. Os trechos marcados com `[PREENCHER]` dependem de uma resposta sua (lista na seção 7).

---

## 1. Resumo em 10 linhas

1. **O que está bom:** a rua da landing é desenhada pela mesma função que a primeira cena do jogo (`src/engine/scenes/street.ts`, semente fixa). A caminhada por rolagem é clara, o texto é curto e o ranking já foi desenhado sem e-mail (`supabase/migrations/20261022000002_rls_and_functions.sql:299-300`).
2. **O que mais pesa:** a passagem da porta para o jogo. O visitante caminha até a porta da rua e, ao entrar, cai no salão com o herói no meio da sala e um cartão de "Atualização" de 06/10 por cima (`src/landing/landing.ts:295`, `src/engine/scenes/HubScene.ts:107-111`, `src/app/App.ts:203`).
3. **Promessas que hoje não batem com o produto:** "exportar ou apagar seus dados" não tem nenhuma tela (as funções existem só no SQL), "nível por tema" é na verdade um nível global de XP, e "questões originais" pode conflitar com o guia de conteúdo, que diz que o material vem dos cadernos do dono (`content/README.md:7`).
4. **Nome:** "Quest Hall" é inglês e genérico. Recomendo **Saguinho**: domínio `.com.br` e `.com` livres na consulta de 22/10/2026, nenhuma marca de estudo achada na busca, e liga direto ao saguão. Os três primeiros nomes que eu tinha em mente já estavam ocupados.
5. **Seletor de certificação:** entra depois de "Como funciona", com três tipos de cartão (disponível, em breve, sugerir outra), aviso de não afiliação e e-mail opcional só para o aviso. A escolha vira a porta em que o herói nasce no jogo e fica salva no perfil (ou no navegador, sem conta).
6. **Ordem nova:** abertura, como funciona, certificações, modos, grupos, quem somos, perguntas frequentes e, por último, a rua que termina na porta.
7. **Primeiro passo, só texto e hoje:** tirar a promessa de exportar/apagar até existir a tela, corrigir "nível por tema", ajustar "originais" depois da sua confirmação, e pôr o aviso de não afiliação.
8. **Segundo passo, código pequeno:** não mostrar o cartão de novidades a quem chega pela primeira vez (vira um selo), fazer o herói nascer na porta e usar no salão o acento que a landing usa.
9. **Terceiro passo, código médio:** seletor de certificação com persistência, véu mais leve no login sobre a rua, cartões do salão menos opacos e a marca na fachada do salão.
10. **Depende de você:** nome final (e registro), origem das questões, quem está por trás do projeto, se é gratuito, se a conta é obrigatória e quais certificações você pretende criar de fato.

---

## 2. Nome

### 2.1 Dez ideias

Critérios: curto, fácil de falar e de escrever no Brasil, sentido ligado a estudar, jogar, sala, saguão, porta ou missão. Os domínios foram checados por RDAP (base oficial do Registro.br para `.com.br` e da Verisign para `.com`) em 22/10/2026.

**1. Saguinho.** Diminutivo de "saguão", o hall do jogo.
- *Tom:* acolhedor, brasileiro, de bairro. Brinca sem ser bobo.
- *Tagline:* "Um saguão de estudo, com uma porta para cada sala."
- *Riscos:* "sagui" é o macaco, e alguém vai ler assim na primeira vez. Pode soar infantil para quem quer uma certificação. Mitigação: o texto da landing precisa ser sério onde importa (aviso, perguntas, privacidade).
- *Domínios:* `saguinho.com.br` livre (404 no RDAP); `saguinho.com` livre (404).

**2. Entra Estuda.** Ação de entrar pela porta e estudar.
- *Tom:* direto, bem-humorado, com cara de convite.
- *Tagline:* "Entre na sala e estude."
- *Riscos:* o radical "estuda" é o nome de um concorrente grande. A plataforma Estuda.com diz ter mais de 200 mil questões, e aparece em todas as buscas de estudo. Confusão de marca e SEO difícil. Também é uma frase, não um nome.
- *Domínios:* `entraestuda.com.br` livre (404); `entraestuda.com` livre (404).

**3. Vestíbulo.** "Vestíbulo" é o saguão de entrada, com ligação ao vestibular.
- *Tom:* elegante, um pouco formal.
- *Tagline:* "A entrada da sua preparação."
- *Riscos:* a palavra puxa para o vestibular universitário, que é outro público. O acento complica a escrita. O `.com` está ocupado com bloqueio do dono.
- *Domínios:* `vestibulo.com.br` livre (404); `vestibulo.com` ocupado.

**4. Tá na Porta.** Gíria: "a prova tá na porta".
- *Tom:* urgente e divertido.
- *Tagline:* "A prova tá na porta. Entre e treine."
- *Riscos:* o tom de urgência pode causar ansiedade num público que já estuda sob pressão. A expressão é muito coloquial.
- *Domínios:* `tanaporta.com.br` **ocupado** (registrado por empresa de transporte, com o mesmo nome); `tanaporta.com` ocupado.

**5. Chave Mestra.** Chave para entrar em cada sala, e maestria no sentido de domínio.
- *Tom:* sério, de confiança, com um toque de jogo.
- *Tagline:* "Uma chave para cada sala."
- *Riscos:* expressão muito comum no mercado (chaveiro, fechadura, consultoria). Difícil de proteger.
- *Domínios:* `chavemestra.com.br` **ocupado** (registrado por agência de publicidade); `chavemestra.com` ocupado.

**6. Estudaí.** Gíria "estuda aí", com ritmo de convite.
- *Tom:* simpático, bem brasileiro.
- *Tagline:* "Estuda aí. Joga aqui."
- *Riscos:* o radical "estuda" é o mesmo da Estuda.com. O domínio `.com.br` está registrado por pessoa física e com registro sinalizado para arbitragem.
- *Domínios:* `estudai.com.br` **ocupado** (com disputa); `estudai.com` ocupado.

**7. Degrau.** O passo que se sobe de nível.
- *Tom:* calmo, de progresso.
- *Tagline:* "Um degrau de cada vez."
- *Riscos:* palavra muito usada em educação. Difícil de diferenciar.
- *Domínios:* `degrau.com.br` **ocupado** (consultoria imobiliária).

**8. Salinha.** A sala pequena e aconchegante.
- *Tom:* íntimo, carinhoso.
- *Tagline:* "Sua salinha de estudo."
- *Riscos:* pequeno demais para um produto que quer parecer sério. Pode passar a ideia de algo amador.
- *Domínios:* `salinha.com.br` **ocupado** (empresa de informática).

**9. Rodada.** Cada sessão de estudo é uma rodada de jogo.
- *Tom:* leve, de jogo de tabuleiro.
- *Tagline:* "Mais uma rodada."
- *Riscos:* genérico e difícil de proteger. Os registros existem, mas o `.com.br` consta como inativo com vencimento em 21/08/2026. Pode ser liberado, mas não conte com isso.
- *Domínios:* `rodada.com.br` ocupado no registro, inativo (vencimento 21/08/2026).

**10. Nivela.** Subir de nível e nivelar o conhecimento.
- *Tom:* prático, direto.
- *Tagline:* "Suba de nível, estude de verdade."
- *Riscos:* pode ser lido como "nivelar" (igualar). Ligação fraca com a sala.
- *Domínios:* `nivela.com.br` **ocupado** (empresa).

Verificações extras, só para registro: `chavinha.com.br` e `estudoteca.com.br` estão ocupados por pessoas físicas. `portacerta.com.br` também está ocupado.

### 2.2 Finalistas e checagem

| Nome | `.com.br` | `.com` | Busca web (22/10/2026) | O que NÃO deu para verificar | Veredito |
|---|---|---|---|---|---|
| **Saguinho** | livre (RDAP 404) | livre (RDAP 404) | Nenhum app ou marca de estudo com o nome. Só um jogo de itch.io sobre saguis, sem relação clara. | INPI (base de marcas não acessível pela busca); perfis de Instagram, TikTok e YouTube (exigem login); Google Play e App Store não consultadas diretamente | **Recomendado** |
| **Entra Estuda** | livre (RDAP 404) | livre (RDAP 404) | Nenhuma marca com o nome exato. O radical "estuda" é do Estuda.com, um concorrente grande. | Mesmos itens do INPI e das redes. O risco de confusão precisa de julgamento seu | Segunda opção, com risco de marca |
| **Vestíbulo** | livre (RDAP 404) | ocupado (registrador bloqueia alterações) | Nenhum app com o nome. A palavra aparece quase sempre ligada a vestibular universitário. | INPI e redes, pelos mesmos motivos | Fraco para o público de certificação |

Notas sobre a consulta:
- RDAP 404 significa "não encontrado no momento da consulta". Não garante que o domínio pode ser comprado (pode estar reservado) nem que nenhuma marca usa o nome. Confirme no registrador antes de pagar.
- Não consultei a base do INPI diretamente. A busca web não indexa o INPI. Antes de anunciar o nome, faça a busca no INPI pela classe de educação (41) e de software/app (9 e 42), ou peça a um advogado de propriedade intelectual.

### 2.3 Recomendação: Saguinho

Recomendo **Saguinho** por cinco motivos:
1. É curto (oito letras), não tem acento e é fácil de falar e de escrever.
2. Liga direto ao saguão, que é o lugar central do jogo: quem entra pela porta cai no saguão.
3. Tem tom acolhedor e brasileiro, sem ser inglês genérico.
4. É o único dos três finalistas com os dois domínios livres e sem marca de estudo achada na busca.
5. Como é uma palavra incomum, é fácil de encontrar no Google, algo que "Estuda" e "Degrau" não permitem.

Ressalvas honestas:
- "Sagui" (macaco) é a leitura mais provável na primeira vez. Dá para virar charme, se você quiser um mascote, mas precisa gostar.
- O tom fica mais leve. A landing precisa compensar com seriedade no conteúdo, no aviso e na privacidade.

**Wordmark na navbar (duas partes, no padrão atual de "quest" leve e "hall" negrito):**
`sagu` em peso 300 + `inho` em peso 800, ou seja, `sagu<b>inho</b>`. Lê-se naturalmente e mantém o padrão visual que você já tem. No cenário, o letreiro da fachada (`src/engine/scenes/street.ts:105-106`, caixa de 168 por 40 px) comporta a palavra inteira em 20 px. Hoje o código desenha "quest" e "hall" em dois textos separados (`src/engine/scenes/MenuScene.ts:238-253`, chamado em `:278`), então a troca é de texto, não de layout.

**Favicon e título:**
- `<title>`: "Saguinho · Estudar para a prova sem cara de prova".
- Favicon: uma porta pixel de 32 por 32, em verde-floresta com maçaneta lima, sem letra. Substitui o atual (`public/favicon.svg`), que usa cores da paleta antiga e um símbolo sem relação com o nome.
- `og:title` e `meta description`: ver a seção 3.

Se você preferir **Entra Estuda**, o wordmark também fica natural: `entra<b>estuda</b>`. A troca é só de texto, mas o risco de confusão com a Estuda.com continua.

---

## 3. Texto da landing, seção por seção

Pronto para colar. Os trechos entre colchetes precisam de sua resposta.

### 3.0 Metadados (`index.html`, linhas 10 e 15-18)

- `<title>`: Saguinho · Estudar para a prova sem cara de prova
- `meta description`: Saguinho: treino para certificação em forma de jogo. Perguntas curtas, revisão dos erros e ranking com o seu grupo.
- `og:title`: Saguinho · Estudar para a prova sem cara de prova
- `og:description`: Perguntas curtas, revisão dos erros e ranking com o seu grupo.

### 3.1 Navbar

- Marca: `sagu<b>inho</b>` (link para `#topo`)
- Links: Produto · Certificações · Quem somos
- Botões: tema (☾/☀) · "Começar" (ou "Jogar" se já houver sessão, como hoje)

### 3.2 Abertura (hero)

- **Kicker:** Treino de certificação em forma de jogo
- **Título (h1):** Estudar para a prova sem cara de prova.
- **Subtítulo:** Missões curtas, perguntas no meio da corrida e a revisão de cada erro. Você escolhe a certificação, entra pela porta e treina.
- **Botão principal:** Começar pela porta
- **Botão secundário:** Escolher certificação (leva para a seção de certificações)
- **Linha pequena abaixo dos botões:** Para salvar o seu progresso, você cria uma conta com e-mail e senha. [PREENCHER: confirmar se a conta é obrigatória para entrar no saguão em produção. Hoje o código exige login só quando o Supabase está configurado (`src/landing/landing.ts:330`).]

### 3.3 Como funciona

- **Kicker:** Como funciona
- **Título (h2):** Três passos, sem complicação

**Cartão 1. Escolha a sala**
Cada sala é uma certificação, com missões, ranking e progresso próprios. Ande pelo saguão e entre pela porta que quiser.

**Cartão 2. Jogue uma missão**
O personagem corre sozinho e, de tempos em tempos, o jogo pausa para uma pergunta. Você tem três vidas e, quando elas acabam, ainda ganha uma última chance.

**Cartão 3. Revise os erros**
No fim, a revisão mostra o que você errou. Uma questão só conta como dominada quando a sua última resposta foi certa.

### 3.4 Certificações (seção nova)

Ver a seção 4, que traz o texto completo do seletor.

### 3.5 Modos de jogo

- **Kicker:** Modos de jogo
- **Título (h2):** Quatro jeitos de treinar
- **Subtítulo:** As mesmas perguntas em formatos diferentes. Troque quando enjoar.

Os quatro cartões leem `src/engine/styles.ts` (fonte única). Os textos atuais servem: "Desvie do obstáculo", "Contra o tempo", "Corrida", "Fuja dos ladrões". Se quiser textos diferentes só para a landing, crie um campo `landingBlurb` em `styles.ts`, para não duplicar.

### 3.6 Grupos e progresso

- **Kicker:** Grupos e progresso
- **Título (h2):** Treine com a sua turma

**Cartão 1. Ranking por grupo**
Crie um grupo para a sua equipe ou turma e mande o link de convite. O ranking mostra quem domina mais questões, sempre pelo apelido.

**Cartão 2. Meta diária**
A meta padrão é de 10 questões por dia. A sequência mostra quantos dias seguidos você bateu a meta. [Confira `src/engine/focus.ts:5` se o número mudar.]

**Cartão 3. Seu nível e seu progresso**
Você vê quantas questões já domina, o seu nível de XP e o progresso em cada assunto da sala.

*Correção em relação ao texto atual:* a versão atual diz "o nível por tema". O nível é global (`src/app/App.ts:341`, `levelFor(totalXp)`). O que existe por tema é o domínio por assunto.

### 3.7 Quem somos

- **Kicker:** Quem somos
- **Título (h2):** Um projeto independente de estudo

O Saguinho nasceu da vontade de estudar sem tédio. [PREENCHER: quem faz o projeto, desde quando e por que começou. Pode ser um apelido.]

As perguntas são escritas para o projeto a partir de [PREENCHER: a fonte do conteúdo, em uma frase. Ver a pergunta 2 da seção 7.] Nenhum trecho de material de prova é copiado [PREENCHER: confirmar depois da revisão da origem].

O Saguinho é independente. Não é afiliado, aprovado nem oficial de nenhuma entidade certificadora.

Se você achar um erro numa pergunta, avise: [PREENCHER: canal de contato].

*Observação:* remova o comentário `<!-- Texto provisório... -->` de `index.html:104` antes de publicar.

### 3.8 Dúvidas (seção nova)

- **Kicker:** Dúvidas
- **Título (h2):** Perguntas frequentes

**É gratuito?**
[PREENCHER: sim ou não, e como. O projeto não tem nada de pagamento no código hoje.]

**As perguntas são as da prova oficial?**
Não. São perguntas escritas para o projeto, no tema da certificação, para você treinar. Não são o exame oficial nem trechos dele.

**Preciso de conta?**
Para salvar o progresso e entrar em grupos, sim: e-mail e senha, com confirmação por e-mail. Você pode ver a rua sem conta.

**Meu e-mail aparece para alguém?**
Não. O ranking mostra só o apelido. Para pedir a exclusão da conta: [PREENCHER: como fazer. Hoje a exclusão só existe no banco de dados, sem tela. Ver a seção 5, item A6.]

**Funciona no celular?**
Funciona no navegador do celular. [PREENCHER: confirmar em quais modos é possível jogar só com toque. Teste e liste.]

### 3.9 Entrada (rua e porta, cena fixa)

- **Letreiro na fachada:** `sagu<b>inho</b>`
- **Dica:** Role para caminhar até a porta
- **Porta (ao chegar):** Entrar no saguão
- **Rótulo para leitores de tela:** Entrada do saguão

### 3.10 Privacidade (faixa antes do rodapé)

Usamos seu e-mail para o login e para os avisos da sua conta. O ranking mostra só o apelido. [PREENCHER: link da política de privacidade. Se ela não existir ainda, a faixa fica sem o link, e não com um link quebrado.]

### 3.11 Rodapé

Saguinho · projeto independente · feito para estudar.
Não somos afiliados, aprovados nem oficiais de nenhuma certificadora. Nomes de certificações aparecem só para indicar o tema de estudo.

---

## 4. Seletor de certificação

### 4.1 Onde fica

Na ordem: abertura, **como funciona**, **certificações**, modos, grupos, quem somos, dúvidas e a rua. A escolha vem depois de entender o jogo e antes de escolher o modo, porque a certificação define a sala, e a sala define as missões.

No menu da navbar: link "Certificações" entre "Produto" e "Quem somos".

### 4.2 Texto da seção

- **Kicker:** Escolha o foco
- **Título (h2):** Qual certificação você quer treinar?
- **Microcopy:** Cada certificação vira uma sala no saguão, com as próprias missões e o próprio ranking. Você pode mudar quando quiser.

**Aviso de não afiliação** (logo abaixo dos cartões, em 14 px, cor secundária):

> O Saguinho não é afiliado, aprovado nem oficial de nenhuma entidade certificadora. Os nomes das certificações aparecem só para indicar o tema de estudo. As perguntas são escritas para o projeto e não são o exame oficial nem trechos dele.

### 4.3 As opções

Os três estados são os mesmos para todos os cartões.

**Estado "Disponível agora"** (uma sala já existe)

| Cartão | Título | Subtítulo | Botão |
|---|---|---|---|
| Compliance e câmbio | Compliance e câmbio | Treino no tema da ABT1, com SFN, limites, câmbio, PLD e punições. | **Entrar nesta sala** (primário) |

Obs.: hoje a sala se chama "Sala ABT1" e o título do cartão no jogo também (`content/rooms/compliance/room.json:4`). Recomendo mudar o título para "Compliance e câmbio" e deixar a certificação só no subtítulo, como tema. Ver a seção 5, item A8.

**Estado "Em breve"** (só para o que você pretende criar de fato, ver a seção 7)

Selo "Em breve" em cor secundária. Botão "Quero saber quando chegar" (secundário), que abre o campo de e-mail (seção 4.4).

Lista inicial sugerida, com fonte. Só use o que você pretende criar. Os nomes oficiais mudam, então escreva pelo tema:

| Tema (rótulo no cartão) | Por que está na lista | Fonte |
|---|---|---|
| Distribuição de investimentos | Certificações da Anbima CPA-10, CPA-20 e CEA. A busca mostrou procura recorde em 2025 (mais de 65 mil exames só em dezembro, segundo a Anbima). Em 2026, pela regra nova, essas três são substituídas por CPA, C-Pro R e C-Pro I. Confirme no site da Anbima antes de nomear. | Anbima, comunicado sobre adiamento (`https://www.anbima.com.br/pt_br/noticias/transicao-para-novo-modelo-e-abertura-do-agendamento-de-provas-sao-adiadas.htm`); Monitor Mercantil (`https://monitormercantil.com.br/transicao-para-novo-modelo-de-certificacoes-e-adiada/`) |
| Agente autônomo de investimentos | A certificação Ancord AI é pré-requisito para agente autônomo, segundo materiais de preparação. | TopInvest (`https://www.topinvest.com.br/apostilas-gratuitas-para-certificacao-cpa10-cpa20-cea-ancord-aai-ca300-e-ca600/`); Safra (`https://oespecialista.safra.com.br/10-recomendacoes-para-tirar-a-certificacao-ancord/`) |
| Planejamento financeiro | A certificação CFP é feita em parceria com a Planejar. | euqueroinvestir (`https://euqueroinvestir.com/certificacoes-financeiras`) |
| Câmbio, nível 2 | A ABT2 da Abracam é o segundo nível da ABT1, para outra faixa de responsabilidade. Faz sentido como sequência natural da sala atual. | Okai, dicas sobre ABT1 e ABT2 (`https://okai.com.br/artigo/dicas-sobre-os-conhecimentos-necessarios-para-a-certificacao-abt1-e-abt2-da-abracam`) |

Observações sobre a lista:
- Para **compliance** encontrei poucas fontes de procura. A ABT1 (câmbio e PLD) já é o caminho mais natural para o público de compliance. Não encontrei dado sério de procura para CCO, IBGC ou CGRC, então não as listei.
- O selo PLD/FTP da Abracam é um certificado para **instituições**, não para pessoas. Não entra na lista.
- Certificações de gestão da Anbima (CGA, CGE) aparecem em comunicados sobre a pausa de 2025, mas não as incluí porque não há uso claro no seu público.

**Estado "Sugerir outra"** (último cartão, sempre visível)

- Título: Não achou a sua?
- Texto: Conte qual certificação você gostaria de treinar aqui.
- Campo: texto curto, até 80 caracteres.
- Botão: Enviar sugestão
- Depois de enviar: "Obrigado. Recebemos a sua sugestão."

### 4.4 Campo de e-mail opcional (para o aviso)

Aparece só ao clicar em "Quero saber quando chegar", abaixo do cartão escolhido:

- Rótulo: E-mail (opcional)
- Ajuda: Só para avisar quando esta certificação chegar. Você pode pedir a remoção a qualquer momento: [PREENCHER: contato].
- Checkbox desmarcado por padrão: "Aceito receber este aviso." (consentimento explícito, pela LGPD)
- Botão: Avisar quando chegar
- Depois de enviar: "Anotado. Avisamos quando a sala abrir."

Regras:
- O e-mail não é obrigatório para nada além do aviso.
- O e-mail **não** vai para a tabela de perfis. Fica numa tabela própria (ver 4.6).
- Protegido por Turnstile, como o cadastro, para evitar robôs.

### 4.5 Passo a passo da interação

1. A pessoa rola até "Qual certificação você quer treinar?" e vê os cartões.
2. **Se escolhe "Disponível agora"** (Entrar nesta sala): a escolha é salva (ver 4.6), a rua caminha até a porta e o login aparece, se a conta for obrigatória. No saguão, a porta da sala escolhida já é a que o herói está na frente.
3. **Se escolhe "Em breve"**: abre o campo de e-mail. Ao enviar, aparece a confirmação. A página não muda de lugar.
4. **Se escolhe "Sugerir outra"**: abre o campo de texto. Ao enviar, aparece o agradecimento. Nada é publicado automaticamente.
5. Em qualquer caso, a pessoa pode seguir rolando, e o salão nunca fica bloqueado. A escolha não é obrigatória.

### 4.6 O que acontece ao escolher

**A sala escolhida abre primeiro?** Não à força. O herói nasce na frente da porta dela e o rótulo "Sua sala" aparece sobre a porta. As outras portas continuam acessíveis. Forçar a sala poderia confundir quem quer ver o salão inteiro, que é o que o jogo promete.

**É salva no perfil?** Sim, quando a pessoa tem conta. Sem conta, fica no navegador (por exemplo, como `localStorage`). Quando a pessoa cria a conta, a escolha do navegador sobe para o perfil.

**Tabela e campo mínimos (só descrição, não implementar agora):**

1. `profiles.focus_room_id text null`
   - Guarda o identificador da sala escolhida (por exemplo, `compliance`).
   - Validar contra as salas do projeto (`content/rooms/*`), com regra de formato `^[a-z0-9-]{1,40}$`.
   - Escrita só pelo próprio usuário. Como a tabela `profiles` já tem RLS, basta uma política de update restrita ao próprio id e a esse campo, ou uma função `set_focus_room(p_room_id)`.

2. `certification_interest` (uma tabela para "avisar", "sugerir" e o e-mail)
   - `id uuid primary key default gen_random_uuid()`
   - `kind text not null check (kind in ('follow', 'suggest'))`
   - `certification_key text null` (para `follow`, por exemplo `cpa`, `aai`, `cfp`, `abt2`)
   - `suggestion text null check (char_length(suggestion) <= 80)` (para `suggest`)
   - `email text null` (só para `follow`, com `consent_at` obrigatório quando houver e-mail)
   - `consent_at timestamptz null`
   - `user_id uuid null references auth.users (id) on delete cascade`
   - `created_at timestamptz not null default now()`
   - Restrição de unicidade em `(email, certification_key)` para não repetir o aviso.
   - RLS: `insert` permitido para quem está anônimo ou logado, com limite de taxa e Turnstile. `select` **não** é público: só o dono do projeto lê, pelo painel. Quem tem conta só pode apagar as próprias linhas.
   - Pedido de exclusão: apagar a linha pelo e-mail, com resposta em prazo que você definir.

Regra de ouro: e-mail de aviso não é a mesma coisa que e-mail de conta. Não misture os dois dados.

---

## 5. Disposição e design

### 5.1 Por que o jogo "ficou feio no final" e parece outro produto

Diagnóstico com base no código. A ordem abaixo é a da experiência, do que você vê primeiro ao que você vê por último.

Há três quebras de continuidade, e uma quarta de linguagem visual:
1. **Onde o herói aparece:** a rua termina com o herói na porta, mas o jogo começa com ele no meio do saguão.
2. **O que aparece primeiro:** um cartão de novidades cobre a primeira tela.
3. **Quantas vezes a tela muda:** cinco transições entre o clique e o jogo.
4. **Linguagem visual:** a rua tem céu, prédio com pedra e luz de poste. O saguão é um quadrado de parede e piso quadriculado, com cartões escuros por cima.

### 5.2 Problemas, com arquivo, linha, motivo e correção

**A. Porta da rua leva a um saguão sem o herói na porta**

**A1. O herói nasce no meio do salão.**
- Onde: `src/engine/scenes/HubScene.ts:107-111`. Sem o parâmetro `from`, o herói é colocado em `x = 480`, de frente.
- Motivo: o visitante acabou de caminhar até a porta. O jogo começa com ele em outro lugar. Parece que a porta não levou a lugar nenhum.
- Correção: passar um `enterFrom` (a porta da rua, ou a porta da sala com foco). O herói nasce na frente dessa porta e faz o passo para dentro, em sentido inverso ao da rua. Esforço: M.

**A2. O clique na porta chama o loader.**
- Onde: `src/landing/landing.ts:292-293`. `showLoader()` aparece antes do jogo.
- Motivo: o loader com herói correndo e dicas é bom, mas aparece depois de um fade preto. Quem já viu a rua vê três telas seguidas (rua, preto, loader).
- Correção: mostrar o loader só se o carregamento passar de 400 ms. Caso contrário, passar direto. Esforço: P.

**A3. Fade de 980 ms antes do loader.**
- Onde: `src/landing/landing.ts:240` (espera de 600 ms do herói) e `:242` (fade de 380 ms).
- Motivo: a sequência é lenta e cheia de transições.
- Correção: reduzir para 350 ms no total, com o mesmo fundo do tema (`--color-bg`), para que o fade não pareça uma tela nova. Esforço: P.

**A4. O salão começa no meio do passeio.**
- Onde: `src/app/App.ts:124`. Com `startAt: 'hall'`, o jogo abre direto no salão.
- Motivo: a rua é a metáfora da chegada. Pular a rua era para ser rápido, mas o efeito é de corte seco.
- Correção: ver A1. Esforço: M (junto com A1).

**A5. Login cobre a rua com 72% de fundo.**
- Onde: `src/auth/auth.css:119-121` (`.auth-screen.is-overlay`, `color-mix(... 72%)`).
- Motivo: é o clique mais importante e a rua some atrás de uma camada quase opaca.
- Correção: 45% de fundo e um desfoque leve (`backdrop-filter: blur(4px)`), mantendo o cartão com `px-box`. Esforço: P.

**A6. A landing promete exportar e apagar dados, e não há tela.**
- Onde: `index.html:95` ("Você pode exportar ou apagar seus dados quando quiser").
- Motivo: as funções existem no banco (`supabase/migrations/20261022000002_rls_and_functions.sql:343` `export_my_data` e `:362` `delete_my_account`), mas nenhuma tela do jogo as chama (busca em `src/` não achou nada). Hoje é uma promessa que o jogador não consegue cumprir sozinho.
- Correção imediata (texto): trocar por "Para pedir a exclusão da conta, fale com [PREENCHER: contato]" até existir a tela. Correção definitiva: botões "Exportar meus dados" e "Excluir minha conta" na tela de crachá, ligados às funções que já existem. Esforço: texto P; tela M.

**B. Cartão de novidades logo na chegada**

**B1. O aviso de novidades abre sobre a primeira tela do salão.**
- Onde: `src/app/App.ts:138-143` (`announceUpdate`), chamado em `App.ts:203` dentro de `showHub()`. Como `startAt: 'hall'` chama `showHub()` em `App.ts:124`, o cartão aparece no primeiro quadro.
- Motivo: o cartão que abre hoje é "Novo modo: Fuja dos ladrões" (`src/engine/updates.ts:15-25`), com texto sobre labirinto, moedas, setas e WASD, e a lista "Também chegou" sobre vidas e Hall da Fama. Quem acabou de chegar não jogou nada disso ainda, e a data é de 06/10/2026, dezesseis dias antes de hoje. Além disso, o cartão tem cor lima com `px-box--lime` (`src/engine/ui/UpdateNotice.ts:26`), que compete com o resto da cena.
- Correção: para quem não tem progresso, não mostrar. Mostrar um selo "Novidades" ao lado da marca do salão (o canto superior direito, em `BankMenu.ts:307-312`), que abre o mesmo cartão sob demanda. O cartão automático fica só para quem já tem progresso e voltou ao salão. Esforço: P.

**B2. O cartão captura todas as teclas.**
- Onde: `src/engine/ui/UpdateNotice.ts:68-75` (captura em fase de captura, `stopImmediatePropagation`).
- Motivo: enquanto o cartão está aberto, o teclado do salão (setas, Enter na porta) fica preso, e a primeira tecla que o visitante aperta é engolida.
- Correção: quando o cartão for mostrado sob demanda (B1), deixar as setas funcionarem atrás dele e fechar só com Esc ou clique. Esforço: P.

**B3. "Bora jogar" fecha o cartão e não joga nada.**
- Onde: `src/engine/ui/UpdateNotice.ts:56`.
- Correção: trocar por "Entendi" ou "Voltar ao salão". Esforço: P.

**C. Cores e tema**

**C1. O acento do salão é lima fixo, mas a landing usa o acento do tema.**
- Onde: `src/engine/scenes/HubScene.ts:45` (`LIME = '#DBFFA5'`), usado em `:93` (prompt), `:282` e `:290` (fita e cones de obra) e `:294` (placa). A landing usa `--color-accent` (`src/engine/ui/tokens.css:52` no escuro, `:72` no claro, que é verde `#2E6B1E`).
- Motivo: no dia, a landing tem botões verdes e o salão tem fitas e cones lima. Parecem dois jogos diferentes. Pior: o lima sobre o piso creme tem contraste de cerca de 1,1:1 (cálculo pela fórmula WCAG). O cone de obra quase some.
- Correção: trocar `LIME` por um campo `accent` em `src/engine/palette.ts` (`scene()`), com o mesmo valor do CSS. No dia, verde; à noite, lima. Esforço: P.

**C2. Chips com fundo fixo, em qualquer tema.**
- Onde: `src/engine/scenes/HubScene.ts:94` e `:210`, `backgroundColor: '#1A1615'`. Mesmo caso em `cameoActor.ts:53`.
- Motivo: no dia, o prompt "Entrar" e a dica de teclado viram blocos escuros sobre o creme.
- Correção: usar `scene().stroke` ou a cor de fundo do tema. Esforço: P.

**C3. O salão à noite é quase preto e de piso branco.**
- Onde: `src/engine/palette.ts:154-155` (parede `0x151211`, quase igual ao fundo da página) e `:159-160` (piso `0xFCF8EC` e `0xD4CFC8`).
- Motivo: a noite da rua tem céu verde-petróleo, prédios e luz de poste. A noite do salão é uma caixa preta com quadrados brancos. Não há ponte com a rua. É o que você descreveu como "outro produto".
- Correção: parede em petróleo (`skyBottom` do céu, `0x1F3B35`), piso em tom escuro com um quadriculado mais discreto, e uma faixa com a luz do poste no alto. Esforço: M.

**C4. Dia: o saguão fica claro e lavado.**
- Onde: `src/engine/palette.ts:191-197` (parede `0xefe6d0`, piso `0xfffdf5`/`0xe2d8c0`).
- Motivo: é o contrário da rua de dia (céu azul com nuvens). O salão parece um corredor de repartição.
- Correção: manter o creme, mas trazer a cor do céu para a parede (uma faixa azul-claro no alto, e uma janela com a rua). Esforço: M.

**D. Cartões cobrem a cena**

**D1. Os cartões do salão e da sala são 97% opacos.**
- Onde: `src/engine/ui/bank-menu.css:49` (`.bank-panel`), `:187` (`.bank-card`) e `:319` (`.bank-hall`), todos com `color-mix(... 97%)`.
- Motivo: dentro da sala, o painel, a preparação e o Hall da Fama cobrem quase toda a cena. O herói e o gato ficam numa faixa estreita embaixo (herói em `MenuScene.ts:426`, gato em `:437`).
- Correção: 88% com `backdrop-filter: blur(3px)` no painel principal, e 80% nos cartões menores. Ou reorganizar: painel principal à direita, cartões empilhados à esquerda, com a cena visível no centro. Esforço: M.

**D2. Três cartões em sequência sem indicação de passo.**
- Onde: `BankMenu.ts:400-460`. Missão, modo e tamanho são três telas no mesmo cartão, sem "2 de 3".
- Correção: indicador de passo no kicker ("Passo 2 de 3 · Modo de jogo"). Esforço: P.

**E. Linguagem visual e nome**

**E1. O nome aparece em quatro versões.**
- "Quest Hall" em `index.html:18` e `:25`, `HubScene.ts:198`, `BankMenu.ts:108-109`.
- "Quest Hall · Salão de Jogos" em `index.html:135`.
- "Salão de Jogos" em `MenuScene.ts:262` (título da sala).
- "Treinamento" em `MenuScene.ts:256` (kicker, herança do projeto de origem; o UI-REVIEW já apontava isso).
- Correção: uma só marca e um só kicker: "SAGUINHO · SALÃO DE ESTUDO". Esforço: P (texto).

**E2. Não há fachada no salão.**
- Onde: a fachada e o letreiro existem na rua (`street.ts:105-106`, letreiro em `landing.css:434-446`), mas o salão só tem um texto no canto (`BankMenu.ts:96-111`).
- Motivo: o salão não tem nada que lembre a rua.
- Correção: uma placa pixel no alto do salão com a marca, no mesmo estilo do letreiro da landing (mesma fonte, mesmo peso). Esforço: M.

**E3. Textos da landing que o jogo contradiz.**
- "Sala ABT1" e "Prova ABT1" (`content/rooms/compliance/room.json:4, 5, 7, 11`), "Dia da Prova" (`room.json:25`). O texto "As 106 questões do simulado da certificação" (`room.json:26`) sugere simulado oficial. "Treino para a certificação ABT1" (`room.json:9`) é mais honesto.
- Correção: "Sala de Compliance" (ou "Compliance e câmbio") no título, "Simulado completo" em vez de "Dia da Prova", e "Simulado com 106 questões originais" em vez de "simulado da certificação". Esforço: P (texto em `content/`).

**E4. A UI-REVIEW já não bate com o código em alguns pontos.**
- "Faça Simples." saiu. O código tem "Estude. Jogue. Repita." (`MenuScene.ts:512`).
- O aviso de teclado já é condicional (`MenuScene.ts:281`, `HubScene.ts:205`).
- Há `<meta name="theme-color">` (`index.html:11`).
- O "Pac-man" virou "Fuja dos ladrões" (`styles.ts:34`).
- Os cartões já usam tokens, mas a opacidade de 97% continua (D1).

### 5.3 Ordem nova das seções e o que aparece a cada rolagem

| Ordem | Seção | O que a pessoa vê | Por que nesta posição |
|---|---|---|---|
| 0 | Navbar (fixa) | Marca, Produto, Certificações, Quem somos, tema, Entrar | Acesso rápido ao seletor |
| 1 | Abertura | Título, subtítulo, Começar pela porta, Escolher certificação. Céu pixel ao fundo | Promessa em cinco segundos |
| 2 | Como funciona | Três cartões | Tira a dúvida "é quiz?" |
| 3 | **Certificações (nova)** | Cartões de disponível, em breve e sugerir outra. Aviso de não afiliação | Escolha de foco antes dos modos |
| 4 | Modos | Quatro cartões | Como se joga |
| 5 | Grupos e progresso | Três cartões | Motivo para criar conta |
| 6 | Quem somos | Texto curto e independência | Confiança |
| 7 | **Dúvidas (nova)** | Cinco perguntas | Responde objeções antes da porta |
| 8 | Rua e porta (fixa, por último) | A rua, o herói caminha, o botão Entrar aparece ao chegar | Fecho e transição para o jogo |
| Rodapé | Privacidade e não afiliação | Links e aviso | Obrigatórios |

A rua fica por último de propósito: a rolagem termina na porta, e a porta é o clique que leva ao jogo.

### 5.4 O que mudar na primeira tela do jogo para parecer continuação da landing

1. **Nascer na porta (A1).** O herói começa na frente da porta do foco, ou da primeira porta disponível, se não houver foco.
2. **Sem cartão por cima (B1).** O salão abre limpo. Novidades só por selo.
3. **Título do salão em linguagem de estudo.** Kicker "SAGUINHO · SALÃO DE ESTUDO" e título "Qual sala você treina hoje?" no lugar de "Escolha sua sala" (`HubScene.ts:204`). Fica coerente com o seletor da landing.
4. **Acento do tema (C1, C2).** Verde no dia, lima à noite, em todos os elementos.
5. **Placa com a marca no alto (E2).** Uma placa pixel com a marca, do mesmo estilo do letreiro da rua. É a ponte visual mais forte entre as duas telas.
6. **Seletor dentro do jogo.** Um chip no canto superior direito, ao lado da marca (`BankMenu.showChrome`, `BankMenu.ts:307-312`), com "Sua sala: Compliance e câmbio ▾". Abre a mesma lista do seletor da landing (mesmo componente DOM). Sem modal ao entrar: a lista só aparece se a pessoa clicar.
7. **Dica de porta, uma linha.** Na base do salão, "Escolha uma porta. Você pode trocar de sala a qualquer momento." Substitui o cartão de novidades como primeira orientação.

---

## 6. Lista priorizada

Esforço: P = até meio dia, M = de um a três dias, G = mais de três dias.
Os itens **(texto)** podem ser feitos agora, sem código. Os itens **(código)** exigem mudança em `src/` ou em `supabase/`.

### P0: fazer antes de publicar a landing

| # | Mudança | Tipo | Esforço | Depende de você? |
|---|---|---|---|---|
| 1 | Tirar a promessa de "exportar ou apagar dados" (ou trocar por contato) (A6) | texto | P | Sim: canal de contato |
| 2 | Corrigir "nível por tema" para "nível de XP e domínio por assunto" (3.6) | texto | P | Não |
| 3 | Trocar "originais, escritas para o projeto" pelo texto que você confirmar (3.7) | texto | P | Sim: origem das questões |
| 4 | Pôr o aviso de não afiliação na seção e no rodapé (4.2, 3.11) | texto | P | Não |
| 5 | Trocar "Dia da Prova", "simulado da certificação" e "Sala ABT1" nos textos de sala (E3) | texto | P | Sim: nome da sala |
| 6 | Reescrever a abertura, como funciona, quem somos, e incluir dúvidas e privacidade (seção 3) | texto | P a M | Sim: dados reais |
| 7 | Remover o comentário "Texto provisório" de `index.html:104` | texto | P | Não |
| 8 | Checar o nome no INPI e nas redes antes de trocar qualquer texto (seção 2) | decisão | P | Sim |

### P1: código pequeno, grande ganho de continuidade

| # | Mudança | Tipo | Esforço | Onde |
|---|---|---|---|---|
| 9 | Não mostrar o cartão de novidades para quem chega; selo "Novidades" (B1) | código | P | `App.ts:138-143, 203`; `BankMenu.ts` |
| 10 | Botão do cartão "Entendi", e setas livres atrás dele (B2, B3) | código | P | `UpdateNotice.ts:56, 68-75` |
| 11 | Acento do tema no salão (C1) e chips sem cor fixa (C2) | código | P | `HubScene.ts:45, 93-94, 210`; `palette.ts` |
| 12 | Loader só se o carregamento passar de 400 ms; fade de 350 ms (A2, A3) | código | P | `landing.ts:240-242, 292-293` |
| 13 | Véu de 45% no login sobre a rua (A5) | código | P | `auth.css:119-121` |
| 14 | Indicador de passo nos menus da sala (D2) | código | P | `BankMenu.ts:400-460` |
| 15 | Unificar o nome e o kicker (E1) | código e texto | P | `index.html`, `HubScene.ts:198`, `MenuScene.ts:256-262`, `BankMenu.ts:96-111` |
| 16 | Wordmark de duas partes na navbar, na fachada e no título | código | P | `index.html:25, 114`; `MenuScene.ts:278` |
| 17 | Favicon novo (porta pixel) | código (asset) | P | `public/favicon.svg` (só depois de você decidir o nome) |

### P2: código médio, pede decisão de produto

| # | Mudança | Tipo | Esforço | Onde |
|---|---|---|---|---|
| 18 | Seletor de certificação na landing, com estados e campo de e-mail (seção 4) | código | M | `landing.ts`, `landing.css`, `index.html` |
| 19 | Tabelas `focus_room_id` e `certification_interest`, com RLS (4.6) | código (migração) | M | `supabase/migrations/` (novo arquivo) |
| 20 | Herói nasce na porta do foco (A1, A4) | código | M | `HubScene.ts:107-111`; `landing.ts:295`; `App.ts:124` |
| 21 | Seletor dentro do jogo como chip (5.4, item 6) | código | M | `BankMenu.ts`, componente compartilhado |
| 22 | Cartões do salão com 88% de opacidade e blur (D1) | código | M | `bank-menu.css:49, 187, 319` |
| 23 | Placa pixel com a marca no alto do salão (E2) | código | M | `HubScene.ts`, `street.ts` |
| 24 | Botões "Exportar meus dados" e "Excluir minha conta" (A6, versão completa) | código | M | `src/state/`, tela de crachá; funções já no SQL |
| 25 | Parede e piso do salão à noite e de dia (C3, C4) | código | M a G | `palette.ts:154-197`; `HubScene.ts:181-189` |
| 26 | Página de privacidade e de dúvidas, separada da landing | texto e código | M | nova rota |

### Ordem recomendada

Primeiro os itens 1 a 8 (texto e decisão). Depois o bloco P1 inteiro, que resolve a sensação de "outro produto" sem mexer em dados. Por fim, o seletor (18 e 19) e a continuidade mais profunda (20 a 23).

---

## 7. O que depende da sua resposta

1. **Nome.** Saguinho, Entra Estuda ou outro? Você quer registrar a marca no INPI (com advogado)? Vai comprar o domínio?
2. **Origem das questões.** O guia de conteúdo diz que o material vem de cadernos seus (`content/README.md:7`). Esses cadernos são notas próprias, de curso, ou de material de empresa? A resposta define se a landing pode dizer "originais" e "escritas para o projeto".
3. **Quem está por trás do projeto.** Nome ou apelido, cidade e desde quando, para a seção "Quem somos".
4. **A conta é obrigatória** para entrar no saguão em produção? Hoje depende da configuração do Supabase (`landing.ts:330`).
5. **É gratuito?** Hoje não há nada de pagamento no código.
6. **Canal de contato** para erros nas perguntas e para pedidos de exclusão de conta. Também a política de privacidade: já existe?
7. **Certificações em breve.** Quais você pretende criar de fato? A lista da seção 4.3 é só uma sugestão com fontes. Só entra como "em breve" o que você vai produzir. A Anbima está mudando os nomes em 2026, então confirme antes de nomear.
8. **Sala de compliance.** Manter "ABT1" no título, ou trocar por "Compliance e câmbio" com a certificação só como tema? Recomendo a segunda opção, mas a decisão é sua.
9. **Número de questões da prova.** `content/README.md:49` diz 45, mas `room.json:26` e o teste (`tests/content/questions.test.ts:77`) dizem 106. Confirme e corrija o README.
10. **Toque.** Em quais modos é possível jogar só com toque? Teste em celular antes de anunciar.
11. **Prova social.** Hoje não há nenhum número, depoimento ou dado de uso no código. Não sugiro colocar nada disso sem dado real e autorizado. Se houver algo real, me diga o que é.

---

## Fontes consultadas

Certificações e mudança de regra:
- Anbima, adiamento da transição e do agendamento: https://www.anbima.com.br/pt_br/noticias/transicao-para-novo-modelo-e-abertura-do-agendamento-de-provas-sao-adiadas.htm
- Anbima, pausa de fim de 2025: https://www.anbima.com.br/pt_br/noticias/certificacoes-anbima-terao-pausa-no-fim-de-2025.htm
- Monitor Mercantil, resumo do adiamento e da procura recorde: https://monitormercantil.com.br/transicao-para-novo-modelo-de-certificacoes-e-adiada/
- euqueroinvestir, visão geral das certificações financeiras: https://euqueroinvestir.com/certificacoes-financeiras
- TopInvest, materiais sobre CPA, CEA, Ancord AI e CA-600: https://www.topinvest.com.br/apostilas-gratuitas-para-certificacao-cpa10-cpa20-cea-ancord-aai-ca300-e-ca600/
- Safra, sobre a certificação Ancord: https://oespecialista.safra.com.br/10-recomendacoes-para-tirar-a-certificacao-ancord/
- Okai, sobre ABT1 e ABT2 da Abracam: https://okai.com.br/artigo/dicas-sobre-os-conhecimentos-necessarios-para-a-certificacao-abt1-e-abt2-da-abracam
- Okai, selo de conformidade PLD/FTP da Abracam: https://okai.com.br/artigo/selo-abracam-de-conformidade-em-pld

Nomes e domínios:
- Estuda.com (concorrente com o radical "estuda"): https://estuda.com/tudo-sobre-a-plataforma-estuda-com/
- Registro.br (RDAP): https://rdap.registro.br/domain/<nome>.com.br
- Verisign (RDAP para .com): https://rdap.verisign.com/com/v1/domain/<nome>.com

Limites desta revisão:
- Não há captura de tela. Tudo sobre aparência vem do código e dos CSS, não de uma tela real. Os contrastes são cálculos.
- O jogo não foi executado. Os caminhos e as linhas citados são os do código lido.
- A consulta RDAP é de 22/10/2026 e não garante disponibilidade para compra.
- A base do INPI e as redes sociais não foram consultadas diretamente.
- As migrações do Supabase existem no repositório, mas não confirmei se estão aplicadas no banco de produção.

## LANDING REVIEW COMPLETE
