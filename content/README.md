# Guia de autoria de conteúdo — Salão de Jogos

Todo texto de questão vive em JSON aqui; o motor (`src/`) nunca contém texto de questão.

## Origem do conteúdo

As questões são originais, escritas para o projeto no tema da certificação. Não copie texto de prova nem de material de terceiros. Dúvidas de conteúdo (gabarito ambíguo, artigo não conferido) devem ser revisadas por quem é dono do material.

## Sem dados pessoais

Nada de CPF, CNPJ, e-mail ou telefone, reais ou com cara de reais. `tests/content/questions.test.ts` varre tudo e falha se achar.

## Salas

O jogo é um saguão com uma porta por sala. Cada sala é uma pasta em `content/rooms/<id>/`:

```
content/rooms/compliance/room.json
content/rooms/compliance/questions/*.json
content/rooms/banking/room.json
content/rooms/banking/questions/   (vazia por enquanto: a sala abre com "missões em breve")
```

**Para criar uma sala nova:** crie a pasta, um `room.json` e (quando tiver) os arquivos de questões. O saguão desenha a porta sozinho, sem tocar em código. Campos do `room.json`:

| Campo | O que é |
|---|---|
| `id` | igual ao nome da pasta; só `a-z`, `0-9` e hífen |
| `order` | posição da porta no saguão (único) |
| `title`, `tagline` | nome na placa da porta e frase de apoio |
| `accent` | cor da porta, `#RRGGBB` |
| `kicker`, `menuTitle` | textos acima da lista de missões |
| `blurb`, `emptyNote` | descrição da sala e o aviso enquanto ela não tem questões |
| `examLabel` | opcional: nome da linha de "prova" no cartão de preparação |
| `remoteBank` | opcional: a sala pode receber o banco publicado pela planilha (só Compliance hoje) |
| `categories` | categorias aceitas pelas questões da sala |
| `modes` | as missões: `id`, `kind`, `title`, `description` e, em `category`, a categoria |

Tipos de missão (`kind`): `exam` (questões com `"exam": true`), `category` (questões da `category`), `all` (todas da sala) e `wrong` (as que o jogador errou por último). O `id` de uma missão é salvo com cada partida: nunca renomeie um que já tenha histórico, e não repita ids entre salas. Os ids das questões também são únicos no jogo todo (`tests/content/questions.test.ts` confere).

O progresso, o perfil e o Hall da Fama são **por sala**; o apelido é um só para todas. Partidas salvas antes do saguão contam como Compliance.

## Arquivos e modos (sala de Compliance)

Todos os arquivos `content/rooms/compliance/questions/*.json` são carregados juntos (`{ "questions": [...] }`). Quem decide em qual modo a questão aparece são os campos `categories` e `exam`:

| Modo | Regra |
|---|---|
| Prova Abt1 | `"exam": true` (106 questões: 45 de `prova-abt1.json` e 61 de `simulado-abt1.json`) |
| Treino Agentes do SFN | `categories` contém `sfn` |
| Treino Limites transacionais e reportes | contém `limites` |
| Treino operações no mercado cambial | contém `cambio-pld` |
| Treino regras de punições de poderes | contém `punicoes` |
| Questões que errei | ids do histórico do jogador |

Uma questão pode estar em várias categorias. Para adicionar um caderno novo, crie um arquivo novo com ids únicos (ex.: `abc-01`); para uma categoria nova, inclua-a em `categories` e crie a missão em `modes` no `room.json` da sala.

## Formato

```json
{
  "sceneId": "lim-01",
  "categories": ["limites"],
  "topicTag": "limite-cambio-especie",
  "dialogue": [{ "speaker": "Nome Sobrenome — Cargo", "text": "Contexto curto de trabalho." }],
  "question": "Enunciado.",
  "choices": [
    { "id": "a", "text": "Alternativa", "correct": true, "feedback": "Por que está certa." },
    { "id": "b", "text": "Alternativa", "correct": false, "feedback": "Por que está errada." }
  ],
  "xpOnCorrect": 10
}
```

Regras (checadas por `src/engine/content/validateContent.ts`): `sceneId` único; `topicTag` em kebab-case; `speaker` no formato `"Nome — Cargo"`; 2 a 4 alternativas, exatamente 1 correta, `feedback` não vazio e diferente em cada uma; `xpOnCorrect` inteiro positivo. As alternativas são embaralhadas a cada vez: não escreva "alternativas (b) e (c)".

## Editar pela planilha (sem build nem deploy)

As questões do repositório são o **piso**: o jogo sempre abre com elas ou com o último banco baixado da planilha. Quem edita usa a planilha do jogo (a mesma dos placares):

1. Aba **Rascunho** — uma linha por questão (colunas: `sceneId, status, categorias, prova, topicTag, xp, fala1_autor, fala1_texto, fala2_autor, fala2_texto, pergunta, correta, a_texto … d_feedback`). `status` é `ativa` ou `arquivada`; `categorias` separadas por vírgula; `prova` é `sim`/`nao`; `correta` é a letra (a–d). Alternativas c e d podem ficar vazias.
2. Menu **Compliance Quest → Validar rascunho** mostra os erros linha a linha. **Validar e publicar** grava o snapshot na aba **Publicado** com uma versão nova. As regras são as mesmas deste guia (mais "sem dado pessoal").
3. O jogo busca o banco publicado em segundo plano ao abrir, valida de novo e passa a usá-lo **na próxima vez que abrir**. Se algo falhar, continua com o banco que tinha.

Regras que a planilha impõe: o `sceneId` nunca muda nem some (o histórico dos jogadores aponta para ele) — para tirar uma questão do jogo, troque o status para `arquivada`. Texto original, nunca trecho literal do material de prova, continua sendo revisão humana.

Comandos (a partir da raiz):

| Comando | Para quê |
|---|---|
| `npm run sheet:rascunho` | Gera `dist-sheet/rascunho.csv` com todo o banco, para importar na aba Rascunho (Arquivo → Importar → Substituir planilha). |
| `npm run sheet:exportar -- Publicado.csv` | Compara o que a planilha publicou com o bundle. Com `--replace`, reescreve `content/rooms/compliance/questions/` (vira `banco-planilha.json`) para o piso não ficar defasado. Baixe a aba Publicado como CSV. |

## Checklist antes de commitar

1. `npm test` verde.
2. `npx tsc --noEmit` limpo.
3. Jogue uma rodada: o texto cabe na tela e as alternativas fazem sentido embaralhadas.
