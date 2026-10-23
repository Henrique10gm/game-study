// The name of the product, in ONE place. The wordmark is written in two parts: the first
// in a light weight, the second in bold ("quest" + "hall"). To rename the product, change
// this file (and public/favicon.svg): the game, the landing page and index.html (through
// the Vite plugin in vite.config.ts, which fills the {{BRAND_*}} marks) all read it.
export const BRAND = {
  light: 'quest',
  bold: 'hall',
  name: 'Quest Hall',
  place: 'Salão de Jogos',
  tagline: 'Estudar para a prova sem cara de prova',
  description: 'Treino para certificação em forma de jogo. Perguntas curtas, revisão dos erros e ranking com o seu grupo.',
} as const;

/** "quest hall" in lower case: the label a screen reader reads for the wordmark. */
export const BRAND_SPOKEN = `${BRAND.light} ${BRAND.bold}`;

/** Caps line over the street and the hall: "QUEST HALL · SALÃO DE JOGOS". */
export function brandKicker(suffix: string = BRAND.place): string {
  return `${BRAND.name} · ${suffix}`.toUpperCase();
}
