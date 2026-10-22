// Picks the store for where the game is running:
//  1. served by the Apps Script web app (google.script.run exists) -> that script;
//  2. built with VITE_APPS_SCRIPT_URL -> the script through fetch;
//  3. otherwise the local (offline) store that keeps progress in this browser.
import type { QuestionsFetcher } from '../engine/content/remoteContent';
import type { GameStore } from './GameStore';
import {
  AppsScriptGameStore,
  fetchTransport,
  googleScriptRun,
  scriptRunTransport,
  type Transport,
} from './AppsScriptGameStore';
import { LocalGameStore } from './LocalGameStore';

function scriptTransport(): Transport | null {
  const run = googleScriptRun();
  if (run) return scriptRunTransport(run);
  const url = import.meta.env.VITE_APPS_SCRIPT_URL;
  return url ? fetchTransport(url) : null;
}

export function createStore(): GameStore {
  const transport = scriptTransport();
  return transport ? new AppsScriptGameStore(transport) : new LocalGameStore();
}

/** Reaches the published question bank; null when there is no backend (bundle only). */
export function createQuestionsFetcher(): QuestionsFetcher | null {
  const transport = scriptTransport();
  return transport ? (knownVersion) => transport({ action: 'questions', knownVersion }) : null;
}
