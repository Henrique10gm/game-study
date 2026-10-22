// Bridges the question bank and the Google Sheet used to edit it (the Rascunho /
// Publicado tabs of backend/Code.gs). Pure functions, shared by
// scripts/questions-sheet.mjs: bank -> Rascunho CSV (to seed the sheet) and
// Publicado CSV -> bank (to refresh the bundled fallback). Keep the column order
// in sync with DRAFT_HEADERS in backend/Code.gs.
import type { QuestionContent } from './types';

export const DRAFT_HEADERS = [
  'sceneId', 'status', 'categorias', 'prova', 'topicTag', 'xp',
  'fala1_autor', 'fala1_texto', 'fala2_autor', 'fala2_texto', 'pergunta', 'correta',
  'a_texto', 'a_feedback', 'b_texto', 'b_feedback', 'c_texto', 'c_feedback', 'd_texto', 'd_feedback',
];

const CHOICE_LETTERS = ['a', 'b', 'c', 'd'];

export function questionToDraftRow(question: QuestionContent): string[] {
  const [first, second] = question.dialogue;
  const row = [
    question.sceneId,
    'ativa',
    question.categories.join(', '),
    question.exam ? 'sim' : 'nao',
    question.topicTag,
    String(question.xpOnCorrect),
    first?.speaker ?? '',
    first?.text ?? '',
    second?.speaker ?? '',
    second?.text ?? '',
    question.question,
    question.choices.find((choice) => choice.correct)?.id ?? '',
  ];
  for (const letter of CHOICE_LETTERS) {
    const choice = question.choices.find((c) => c.id === letter);
    row.push(choice?.text ?? '', choice?.feedback ?? '');
  }
  return row;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** The Rascunho CSV that seeds the sheet with every question of the bank. */
export function bankToDraftCsv(questions: QuestionContent[]): string {
  return toCsv([DRAFT_HEADERS, ...questions.map(questionToDraftRow)]);
}

/** Active questions of a downloaded Publicado tab (columns: sceneId, status, json, …). */
export function publishedCsvToQuestions(csv: string): QuestionContent[] {
  const [header, ...rows] = parseCsv(csv);
  const status = header?.indexOf('status') ?? -1;
  const json = header?.indexOf('json') ?? -1;
  if (status < 0 || json < 0) throw new Error('CSV sem as colunas "status" e "json": baixe a aba Publicado.');
  return rows
    .filter((row) => row[status]?.trim() === 'ativa' && row[json]?.trim())
    .map((row) => JSON.parse(row[json]) as QuestionContent);
}
