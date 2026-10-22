// Guards ENG-03: the engine (src/) never hardcodes scenario text. Collects
// every question, dialogue text, speaker, choice text and choice feedback
// (length >= 12, to avoid false positives on short incidental substrings),
// plus every sceneId and topicTag, from all real content via contentRegistry,
// then asserts none of those strings appears anywhere under src/**/*.{ts,css}.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contentRegistry } from '../../src/engine/content/contentRegistry';

const MIN_LEN = 12;

function listFilesRecursive(dir: string, exts: string[]): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectContentStrings(): Set<string> {
  const strings = new Set<string>();
  for (const scene of contentRegistry.listQuestions()) {
    strings.add(scene.sceneId);
    strings.add(scene.topicTag);
    if (scene.question.length >= MIN_LEN) strings.add(scene.question);
    for (const line of scene.dialogue) {
      if (line.speaker.length >= MIN_LEN) strings.add(line.speaker);
      if (line.text.length >= MIN_LEN) strings.add(line.text);
    }
    for (const choice of scene.choices) {
      if (choice.text.length >= MIN_LEN) strings.add(choice.text);
      if (choice.feedback.length >= MIN_LEN) strings.add(choice.feedback);
    }
  }
  return strings;
}

describe('no-hardcoded-content: ENG-03 guard — no content text/id from content/ appears in src/', () => {
  it('none of the collected content strings appears in any src/**/*.{ts,css} file', () => {
    const strings = collectContentStrings();
    expect(strings.size).toBeGreaterThan(0);

    const srcRoot = join(process.cwd(), 'src');
    const files = listFilesRecursive(srcRoot, ['.ts', '.css']);
    const fileContents = files.map((file) => ({ file, content: readFileSync(file, 'utf-8') }));

    const offenders: string[] = [];
    for (const str of strings) {
      for (const { file, content } of fileContents) {
        if (content.includes(str)) {
          offenders.push(`"${str.slice(0, 40)}" found in ${file}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
