// Guards threat T-01-01 (XSS via content JSON rendered as markup). Two checks:
// (1) static grep over every file under src/ for the four forbidden DOM APIs;
// (2) a rendering check that a scene whose question is a raw HTML payload
// string renders as inert text, never as an element, inside #ui-root.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DialogueOverlay } from '../../src/engine/ui/DialogueOverlay';
import type { QuestionContent } from '../../src/engine/content/types';

const FORBIDDEN_PATTERNS = [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/];

function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

describe('dom-safety: no markup-injection APIs anywhere in src/', () => {
  it('grep guard: none of innerHTML/outerHTML/insertAdjacentHTML/document.write appear in src/', () => {
    const srcRoot = join(process.cwd(), 'src');
    const files = listFilesRecursive(srcRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${file}: matches ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('rendering an XSS-payload question never creates markup — it renders as literal text', () => {
    const uiRoot = document.createElement('div');
    uiRoot.id = 'ui-root';
    document.body.appendChild(uiRoot);

    const payload = '<img src=x onerror=alert(1)>';
    const maliciousScene: QuestionContent = {
      sceneId: 'xss-fixture-01',
      categories: ['sfn'],
      topicTag: 'xss-fixture',
      dialogue: [{ speaker: 'Pessoa Fictícia — Cargo de Teste', text: 'Texto de teste.' }],
      question: payload,
      choices: [
        { id: 'a', text: 'Alternativa A', correct: true, feedback: 'Feedback A.' },
        { id: 'b', text: 'Alternativa B', correct: false, feedback: 'Feedback B.' },
      ],
      xpOnCorrect: 10,
    };

    const overlay = new DialogueOverlay(uiRoot);
    overlay.showDecision(maliciousScene, () => {});

    expect(uiRoot.querySelectorAll('img')).toHaveLength(0);

    const question = uiRoot.querySelector('[data-testid="dialogue-question"]');
    expect(question?.textContent).toBe(payload);

    overlay.unmount();
    uiRoot.remove();
  });
});
