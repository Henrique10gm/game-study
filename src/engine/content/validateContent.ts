// Content validator. Enforces every authoring rule generically for the whole
// question bank — no per-question branching. See content/README.md for the
// human-facing guide these rules implement.
import type { Category, Choice, DialogueLine, QuestionContent } from './types';

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Personal-data patterns (org data policy) — CPF, CNPJ, e-mail, phone.
const CPF_RE = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
const CNPJ_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const TELEFONE_RE = /\(?\d{2}\)?\s?9?\d{4}-\d{4}/;

export function findPersonalDataPatterns(text: string): string[] {
  const found: string[] = [];
  if (CPF_RE.test(text)) found.push('cpf');
  if (CNPJ_RE.test(text)) found.push('cnpj');
  if (EMAIL_RE.test(text)) found.push('email');
  if (TELEFONE_RE.test(text)) found.push('telefone');
  return found;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function validateSpeaker(speaker: string, prefix: string, lineIndex: number, errors: string[]): void {
  const idx = typeof speaker === 'string' ? speaker.indexOf(' — ') : -1;
  const nameOk = idx > 0;
  const roleOk = idx >= 0 && speaker.slice(idx + 3).trim() !== '';
  if (!nameOk || !roleOk) {
    errors.push(
      `${prefix}: dialogue[${lineIndex}].speaker "${speaker}" must be "Nome — Cargo" with non-empty name and role`,
    );
  }
}

function validateQuestion(question: QuestionContent, errors: string[], categories?: readonly Category[]): void {
  const prefix = question.sceneId;

  if (!Array.isArray(question.categories) || question.categories.length < 1) {
    errors.push(`${prefix}: categories must have at least one category`);
  } else {
    for (const category of question.categories) {
      if (categories && !categories.includes(category)) {
        errors.push(`${prefix}: unknown category "${category}"`);
      }
    }
  }

  if (!KEBAB_CASE_RE.test(question.topicTag)) {
    errors.push(`${prefix}: topicTag "${question.topicTag}" must be kebab-case`);
  }

  const dialogue: DialogueLine[] = question.dialogue ?? [];
  if (dialogue.length < 1) {
    errors.push(`${prefix}: dialogue must have at least 1 line`);
  }
  dialogue.forEach((line, i) => {
    if (!isNonEmptyString(line.text)) {
      errors.push(`${prefix}: dialogue[${i}].text must be non-empty`);
    }
    validateSpeaker(line.speaker, prefix, i, errors);
  });

  if (!isNonEmptyString(question.question)) {
    errors.push(`${prefix}: question must be non-empty`);
  }

  const choices: Choice[] = question.choices ?? [];
  if (choices.length < 2 || choices.length > 4) {
    errors.push(`${prefix}: choices.length must be between 2 and 4, got ${choices.length}`);
  }

  const seenIds = new Set<string>();
  const feedbacks: string[] = [];
  let correctCount = 0;
  for (const choice of choices) {
    if (seenIds.has(choice.id)) {
      errors.push(`${prefix}: duplicate choice id "${choice.id}"`);
    }
    seenIds.add(choice.id);
    if (choice.correct) correctCount += 1;
    if (!isNonEmptyString(choice.text)) {
      errors.push(`${prefix}: choice "${choice.id}" text must be non-empty`);
    }
    if (!isNonEmptyString(choice.feedback)) {
      errors.push(`${prefix}: choice "${choice.id}" feedback must be non-empty`);
    }
    feedbacks.push(choice.feedback);
  }
  if (correctCount !== 1) {
    errors.push(`${prefix}: exactly one choice must be correct, found ${correctCount}`);
  }
  if (new Set(feedbacks).size !== feedbacks.length) {
    errors.push(`${prefix}: choice feedback strings must be pairwise distinct`);
  }

  if (!Number.isInteger(question.xpOnCorrect) || question.xpOnCorrect <= 0) {
    errors.push(`${prefix}: xpOnCorrect must be a positive integer, got ${question.xpOnCorrect}`);
  }
}

/** `categories` = the ones the room accepts (room.json); without it any category passes. */
export function validateQuestionBank(questions: QuestionContent[], categories?: readonly Category[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    if (!isNonEmptyString(question.sceneId)) {
      errors.push('a question has an empty sceneId');
      continue;
    }
    if (seen.has(question.sceneId)) {
      errors.push(`${question.sceneId}: duplicate sceneId`);
    }
    seen.add(question.sceneId);
    validateQuestion(question, errors, categories);
  }

  return errors;
}
