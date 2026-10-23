// The certifications offered on the landing page. "available" ones are a room that exists in
// the game (id = the room id of content/rooms/*); "soon" ones are announced but not playable.
// Only list a "soon" certification the project really intends to build.
export interface Certification {
  id: string;
  title: string;
  blurb: string;
  status: 'available' | 'soon';
}

export const CERTIFICATIONS: readonly Certification[] = [
  {
    id: 'compliance',
    title: 'Certificação ABT1',
    blurb: 'Compliance e câmbio: SFN, limites, câmbio, PLD e punições.',
    status: 'available',
  },
  {
    id: 'novas',
    title: 'Mais certificações',
    blurb: 'Estamos preparando novas salas. Elas aparecem aqui quando estiverem prontas.',
    status: 'soon',
  },
];

export function availableCertifications(): Certification[] {
  return CERTIFICATIONS.filter((certification) => certification.status === 'available');
}
