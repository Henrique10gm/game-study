// The "what's new" notice shown once to everyone who opens the game after an
// update. Add a new entry at the TOP of UPDATES when you ship something worth
// telling; the id is what is remembered, so a new id shows the notice again.
// Copy is UI text, not question content.

export interface GameUpdate {
  id: string; // unique and stable, e.g. "2026-10-06-salao-de-jogos"
  date: string; // as shown to the player
  title: string;
  highlights: string[]; // the main news
  also?: string[]; // smaller things that came along
}

export const UPDATES: readonly GameUpdate[] = [
  {
    id: '2026-10-06-fuja-dos-ladroes',
    date: '06/10/2026',
    title: 'Novo modo: Fuja dos ladrões',
    highlights: [
      'Um labirinto estilo Pac-Man: pegue as moedas e fuja dos ladrões de roupa listrada.',
      'A cada 3 moedas, uma pergunta. Errar custa uma vida; acertar deixa os ladrões mais rápidos e traz mais um para o labirinto.',
      'Ande com as setas ou WASD, ou deslize o dedo na tela. Escolha o modo "Fuja dos ladrões" depois de escolher a missão.',
    ],
    also: ['As vidas, a pergunta de última chance, o coração e o Hall da Fama funcionam como nos outros modos.'],
  },
  {
    id: '2026-10-06-setas-e-sala-abt1',
    date: '06/10/2026',
    title: 'Responda só com o teclado',
    highlights: [
      'Nas perguntas, use ↑ ↓ para escolher a resposta e Enter para confirmar. Enter também passa para a próxima.',
      'A Sala de Compliance agora se chama Sala ABT1. O seu progresso e o Hall da Fama continuam lá.',
      'Tela de carregamento nova: o personagem corre enquanto o jogo abre, com dicas e segredos.',
    ],
    also: [
      'A casa: entre pela porta e escolha a sala. A Sala de Banking chega em breve.',
      'Continuar jogando depois de concluir a fase.',
      'Tela cheia com a tecla F.',
    ],
  },
  {
    id: '2026-10-06-salao-de-jogos',
    date: '06/10/2026',
    title: 'A casa abriu',
    highlights: [
      'Agora você entra pela porta e escolhe a sala que quer treinar, andando com o personagem pela casa.',
      'Sala ABT1: tudo o que você já jogava para a ABT1 continua lá, com o seu progresso intacto.',
      'Sala de Banking: a porta já existe. As missões estão sendo escritas e chegam em breve.',
      'Cada sala tem o seu Hall da Fama e o seu crachá. O apelido vale para todas.',
      'Tem sala em obras no fundo da casa: novas salas vão abrir por ali.',
    ],
    also: [
      'Continuar jogando depois de concluir a fase.',
      'Foco de hoje: meta diária de questões e dias seguidos.',
      'Tela cheia com a tecla F.',
    ],
  },
];

const SEEN_KEY = 'cq.updates.seen.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The update to announce, or null when the player already saw the newest one. */
export function pendingUpdate(storage: StorageLike | null, updates: readonly GameUpdate[] = UPDATES): GameUpdate | null {
  const latest = updates[0];
  if (!latest) return null;
  try {
    return storage?.getItem(SEEN_KEY) === latest.id ? null : latest;
  } catch {
    return latest;
  }
}

export function markUpdateSeen(storage: StorageLike | null, update: GameUpdate): void {
  try {
    storage?.setItem(SEEN_KEY, update.id);
  } catch {
    // storage blocked: the notice just shows again next time
  }
}
