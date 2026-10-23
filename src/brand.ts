// The name of the product, in ONE place. The wordmark is written in two parts: the first
// in a light weight, the second in bold ("study" + "garage"). To rename the product, change
// this file (and public/favicon.svg): the game, the landing page and index.html (through
// the Vite plugin in vite.config.ts, which fills the {{BRAND_*}} marks) all read it.
export const BRAND = {
  light: 'study',
  bold: 'garage',
  name: 'StudyGarage',
  place: 'Estudo em forma de jogo',
  contact: 'contato@studygarage.com',
  tagline: 'Repita até dominar. Sem enjoar',
  description:
    'Pratique o mesmo tema quantas vezes quiser, em rodadas curtas e divertidas, com revisão dos erros e ranking com o seu grupo.',
} as const;

/** "quest hall" in lower case: the label a screen reader reads for the wordmark. */
export const BRAND_SPOKEN = `${BRAND.light} ${BRAND.bold}`;

/** Caps line over the street and the hall: "QUEST HALL · SALÃO DE JOGOS". */
export function brandKicker(suffix: string = BRAND.place): string {
  return `${BRAND.name} · ${suffix}`.toUpperCase();
}
