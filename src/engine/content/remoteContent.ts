// Question bank published from the Google Sheet (backend/Code.gs, action
// `questions`). The bundled bank is the floor: the game always starts with
// either the last bank this browser downloaded or the bundled one, never waiting
// for the network. A newer bank is fetched in the background, validated with the
// same rules as the bundle, stored, and used from the next time the game opens.
// Anything that fails (offline, bad reply, invalid content) keeps the current bank.
import type { Category, ContentSource, QuestionContent } from './types';
import { validateQuestionBank } from './validateContent';

const CACHE_KEY = 'cq.questions.v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface QuestionsReply {
  ok: boolean;
  error?: string;
  version?: number;
  unchanged?: boolean;
  empty?: boolean;
  questions?: unknown;
}

/** Asks the backend for the published bank, telling it which version we hold. */
export type QuestionsFetcher = (knownVersion: number) => Promise<QuestionsReply>;

export type RefreshResult = 'updated' | 'unchanged' | 'rejected' | 'unavailable';

interface CachedBank {
  version: number;
  questions: QuestionContent[];
}

/** Short fingerprint of the bundled bank (FNV-1a). A downloaded bank saved by another build of the
 * game, or by one that did not stamp it, is stale: the bundle of the build in use is newer. */
export function bundleStamp(bundled: readonly QuestionContent[]): string {
  const text = JSON.stringify(bundled);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}-${hash.toString(16)}`;
}

/** Null unless the value is a non-empty bank that passes every authoring rule. */
function validBank(value: unknown, categories?: readonly Category[]): QuestionContent[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === 'object' && item !== null)) return null;
  try {
    return validateQuestionBank(value as QuestionContent[], categories).length === 0 ? (value as QuestionContent[]) : null;
  } catch {
    return null; // a malformed question made the validator throw
  }
}

export function readCachedBank(
  storage: StorageLike | null,
  categories?: readonly Category[],
  stamp?: string,
): CachedBank | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; questions?: unknown; stamp?: unknown };
    if (stamp !== undefined && parsed.stamp !== stamp) return null; // saved under another build: stale
    const questions = validBank(parsed.questions, categories);
    if (!questions || typeof parsed.version !== 'number') return null;
    return { version: parsed.version, questions };
  } catch {
    return null;
  }
}

function sourceOf(questions: QuestionContent[]): ContentSource {
  const byId = new Map(questions.map((q) => [q.sceneId, q]));
  return {
    listQuestions: () => questions,
    getQuestion: (id) => byId.get(id),
  };
}

/** The bank to play with now: the downloaded one when valid, else the bundled one. */
export function createLiveContent(
  bundled: QuestionContent[],
  storage: StorageLike | null,
  categories?: readonly Category[],
): ContentSource {
  return sourceOf(readCachedBank(storage, categories, bundleStamp(bundled))?.questions ?? bundled);
}

/** Looks for a newer published bank and stores it for the next start. Never throws. */
export async function refreshQuestionBank(
  fetcher: QuestionsFetcher,
  storage: StorageLike | null,
  categories?: readonly Category[],
  bundled?: readonly QuestionContent[],
): Promise<RefreshResult> {
  if (!storage) return 'unavailable';
  try {
    const stamp = bundled ? bundleStamp(bundled) : undefined;
    const known = readCachedBank(storage, categories, stamp)?.version ?? 0;
    const reply = await fetcher(known);
    if (!reply.ok) return 'unavailable';
    if (reply.unchanged || reply.empty) return 'unchanged';
    const questions = validBank(reply.questions, categories);
    if (!questions || typeof reply.version !== 'number') return 'rejected';
    storage.setItem(CACHE_KEY, JSON.stringify({ version: reply.version, questions, stamp }));
    return 'updated';
  } catch {
    return 'unavailable';
  }
}
