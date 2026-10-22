// Report of a question/answer problem sent by a player. Local and cloud stores
// share these shapes; the backend (aba Reports) validates the reason ids below.

export const REPORT_REASONS = [
  { id: 'wrong-answer', label: 'A resposta certa não deveria ser essa' },
  { id: 'wrong-justification', label: 'A justificativa está errada' },
  { id: 'many-correct', label: 'Mais de uma alternativa está correta' },
  { id: 'none-correct', label: 'Nenhuma alternativa está correta' },
  { id: 'unclear', label: 'O enunciado está confuso ou ambíguo' },
  { id: 'outdated', label: 'Conteúdo desatualizado (norma ou regra mudou)' },
  { id: 'unrealistic', label: 'O cenário não é realista' },
  { id: 'typo', label: 'Erro de digitação ou de português' },
  { id: 'other', label: 'Outro motivo' },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

/** Reasons that only make sense with a few words from the player. */
export const REASON_NEEDS_COMMENT: readonly ReportReasonId[] = ['other'];

export const MAX_REPORT_COMMENT = 500;

export interface QuestionReport {
  id: string; // client uuid: retrying the same report is harmless
  questionId: string;
  roomId?: string; // missing = Compliance
  reason: ReportReasonId;
  comment: string; // optional free text (may be empty)
  chosenChoiceId: string;
  correctChoiceId: string;
  createdAt: string; // ISO timestamp
}

/** What the question screen knows; the run adds id, room and time. */
export type QuestionReportInput = Omit<QuestionReport, 'id' | 'roomId' | 'createdAt'>;

export function isReportReason(value: string): value is ReportReasonId {
  return REPORT_REASONS.some((reason) => reason.id === value);
}
