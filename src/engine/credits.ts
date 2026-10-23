// Easter egg: the credits of the hall. Everyone here is fictional — the office
// cast from cast.ts plus a few extras — named after the role they play, never
// after real people.
export interface CreditEntry {
  name: string;
  role: string;
}

export const CREDITS: readonly CreditEntry[] = [
  { name: 'Dona Vera', role: 'sua chefe' },
  { name: 'Lia Moraes', role: 'líder de compliance' },
  { name: 'Seu Otávio', role: 'auditoria' },
  { name: 'Dr. Aníbal', role: 'jurídico' },
  { name: 'Duda', role: 'contabilidade' },
  { name: 'Zeca', role: 'manutenção' },
  { name: 'Biscoito', role: 'gato da casa' },
  { name: 'Você', role: 'quem joga' },
];
