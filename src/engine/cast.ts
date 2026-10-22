// The supporting cast: who can pop up during the game and what they say. Pure
// data and selection logic (no Phaser, no DOM). Frames are indexes into
// characters.png (32x32 each). Lines are light office humor; none of them states
// anything about the exam content or promises anything on anyone's behalf.
// Everyone is fictional and named after the role they play (no real people).

export interface CastMember {
  id: string;
  name: string;
  role: string;
  frame: number;
  mug?: boolean; // holds a blue mug
}

export const CAST = {
  chefe: { id: 'chefe', name: 'Dona Vera', role: 'Dir. Executiva', frame: 5, mug: true },
  compliance: { id: 'compliance', name: 'Lia', role: 'Líder de Compliance', frame: 6, mug: true },
  auditoria: { id: 'auditoria', name: 'Seu Otávio', role: 'Auditoria', frame: 2 },
  manutencao: { id: 'manutencao', name: 'Zeca', role: 'Manutenção', frame: 3 },
  juridico: { id: 'juridico', name: 'Dr. Aníbal', role: 'Jurídico', frame: 4 },
  contabilidade: { id: 'contabilidade', name: 'Duda', role: 'Contabilidade', frame: 7, mug: true },
} as const satisfies Record<string, CastMember>;

export type CastId = keyof typeof CAST;

export type CameoTrigger =
  | 'menu'
  | 'correct'
  | 'streak'
  | 'wrong'
  | 'phase'
  | 'ceiling'
  | 'complete'
  | 'perfect'
  | 'gameover'
  | 'coin'
  | 'chefe'
  | 'konami';

export interface Cameo {
  who: CastMember;
  line: string;
}

type Line = readonly [CastId, string];

// What the office says while you are at the bank menu, by readiness stage (0-4).
const MENU_BY_STAGE: readonly (readonly Line[])[] = [
  [
    ['chefe', 'Primeiro dia? Fica à vontade. O café é ali no fundo.'],
    ['chefe', 'Tô passando só pra ver quem está estudando. Pode continuar.'],
    ['compliance', 'Dica de ouro: tudo que você fizer, documenta.'],
  ],
  [
    ['chefe', 'Já saiu do básico. Eu vi daqui.'],
    ['auditoria', 'Posso ver a evidência desse progresso?'],
    ['manutencao', 'Tá aquecendo, hein. Dá pra sentir daqui da manutenção.'],
  ],
  [
    ['chefe', 'Tá pegando o jeito. Dá pra ouvir o teclado lá da minha sala.'],
    ['contabilidade', 'Tá fechando as questões no centavo.'],
    ['compliance', 'Mais uma rodada e você vira referência no time.'],
  ],
  [
    ['chefe', 'Reta final. Segura que falta pouco.'],
    ['juridico', 'Na prova a resposta nunca é "depende". Aqui também não.'],
    ['auditoria', 'Quase tudo auditado. Falta pouco.'],
  ],
  [
    ['chefe', 'Pronto pra prova. Vai lá.'],
    ['compliance', 'Já pode fazer a prova de verdade. Só lembra de abrir os olhos.'],
    ['contabilidade', 'Tá tudo conciliado por aqui. Pode ir.'],
  ],
];

const MENU_FRIDAY: readonly Line[] = [
  ['chefe', 'Sextou! Mas a prova não sabe disso.'],
  ['manutencao', 'Sexta-feira e o pessoal estudando. Respeito.'],
];

const LINES: Record<Exclude<CameoTrigger, 'menu'>, readonly Line[]> = {
  correct: [
    ['compliance', 'Isso aí.'],
    ['auditoria', 'Evidência aceita.'],
    ['manutencao', 'Boa! Passei só pra ver.'],
    ['contabilidade', 'Bateu certinho.'],
  ],
  streak: [
    ['chefe', 'Tô vendo essa sequência daqui da minha sala.'],
    ['auditoria', 'Nenhum erro até agora. Suspeito.'],
    ['chefe', 'Combo bom. Continuem assim, o time todo.'],
  ],
  wrong: [
    ['chefe', 'Errar aqui é de graça. Na prova, não.'],
    ['manutencao', 'Essa pegadinha pegou eu também.'],
    ['juridico', 'Quase. Relê a pergunta com calma.'],
    ['compliance', 'Errou? Anota o motivo. Vale mais do que acertar de primeira.'],
  ],
  phase: [
    ['chefe', 'Aumentou a velocidade? Eu só queria um café.'],
    ['manutencao', 'Segura a moeda!'],
    ['contabilidade', 'Mais rápido que fechamento de mês.'],
  ],
  ceiling: [
    ['manutencao', 'Tá batendo no teto. Chamo a manutenção?'],
    ['auditoria', 'Isso vai constar no relatório.'],
  ],
  complete: [
    ['chefe', 'Rodada fechada. Gostei do que vi.'],
    ['compliance', 'Boa rodada. Revisa as que errou antes de seguir.'],
    ['contabilidade', 'Rodada conciliada.'],
  ],
  perfect: [
    ['chefe', 'Gabaritou. Isso vai pro mural.'],
    ['auditoria', 'Zero erros. Vou pedir pra auditar essa rodada.'],
  ],
  gameover: [
    ['chefe', 'Perdeu as vidas, mas a revanche tá aí.'],
    ['compliance', 'Errar é humano. Registrar o erro é compliance.'],
    ['juridico', 'Todo mundo cai. Levanta e lê a explicação.'],
  ],
  coin: [
    ['manutencao', 'Ei, essa moeda não é minha. Não encosta.'],
    ['contabilidade', 'Moeda a gente conta, não cutuca.'],
  ],
  chefe: [['chefe', 'Alguém me chamou? Eu estava só passando.']],
  konami: [['chefe', 'Konami? Esse eu não conheço. Mas achei bom.']],
};

export interface CameoContext {
  stage?: number; // readiness stage index (menu only)
  friday?: boolean;
}

/** Picks who shows up and what they say. `random` makes it testable. */
export function pickCameo(
  trigger: CameoTrigger,
  context: CameoContext = {},
  random: () => number = Math.random,
): Cameo {
  let pool: readonly Line[];
  if (trigger === 'menu') {
    const stage = Math.min(MENU_BY_STAGE.length - 1, Math.max(0, context.stage ?? 0));
    pool = context.friday && random() < 0.5 ? MENU_FRIDAY : MENU_BY_STAGE[stage];
  } else {
    pool = LINES[trigger];
  }
  const [id, line] = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { who: CAST[id], line };
}

// Faces for the people who talk in the questions (every dialogue speaker gets a
// stable face from their name; the boss's face is reserved for the boss).
const SPEAKER_FRAMES = [0, 1, 2, 3, 4, 6, 7];

export function avatarFrameFor(speaker: string): number {
  let hash = 0;
  for (const char of speaker) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SPEAKER_FRAMES[hash % SPEAKER_FRAMES.length];
}

/** Every line in the game, for tests and for checking the copy in one place. */
export function allCameoLines(): string[] {
  const menu = MENU_BY_STAGE.flat().concat(MENU_FRIDAY);
  const rest = Object.values(LINES).flat();
  return [...menu, ...rest].map(([, line]) => line);
}
