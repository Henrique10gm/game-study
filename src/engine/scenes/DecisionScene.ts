// Generic decision-scene controller (Pattern 1 / Anti-Pattern 1 — a single
// class parameterized by content, never one class or branch per scenario).
// Plain TS, no Phaser dependency, so the whole loop is testable in jsdom.
// Normally there is no timer: the player answers at their own pace. In Contra o
// tempo the caller passes meta.timeLimitMs and running out of time counts as a
// wrong answer.
import { DialogueOverlay } from '../ui/DialogueOverlay';
import type { QuestionMeta } from '../ui/DialogueOverlay';
import { evaluateDecision, timeoutDecision } from '../systems/ScoringSystem';
import type { DecisionOutcome } from '../systems/ScoringSystem';
import type { QuestionContent } from '../content/types';
import type { QuestionReportInput } from '../../state/reports';

export interface DecisionSceneOptions {
  root: HTMLElement;
  /** Sends a player's report about the question; without it there is no "Reportar" button. */
  onReport?: (report: QuestionReportInput) => Promise<'saved' | 'queued'>;
}

const TICK_MS = 200;

export class DecisionScene {
  private readonly root: HTMLElement;
  private readonly onReport?: DecisionSceneOptions['onReport'];

  constructor(opts: DecisionSceneOptions) {
    this.root = opts.root;
    this.onReport = opts.onReport;
  }

  run(scene: QuestionContent, meta?: QuestionMeta): Promise<DecisionOutcome> {
    return new Promise((resolve) => {
      const overlay = new DialogueOverlay(this.root);
      let settled = false;
      let ticker: ReturnType<typeof setInterval> | null = null;

      const settle = (outcome: DecisionOutcome): void => {
        settled = true;
        if (ticker) clearInterval(ticker);
        const onReport = this.onReport;
        overlay.showFeedback(
          scene,
          outcome,
          () => {
            overlay.unmount();
            resolve(outcome);
          },
          onReport
            ? (draft) =>
                onReport({
                  questionId: scene.sceneId,
                  reason: draft.reason,
                  comment: draft.comment,
                  chosenChoiceId: outcome.chosenChoiceId,
                  correctChoiceId: outcome.correctChoiceId,
                })
            : undefined,
        );
      };

      overlay.showDecision(
        scene,
        (choiceId) => {
          if (settled) return; // ignore clicks after a choice already settled this scene
          settle(evaluateDecision(scene, choiceId));
        },
        meta,
      );

      const limit = meta?.timeLimitMs;
      if (limit) {
        const startedAt = Date.now();
        ticker = setInterval(() => {
          if (settled) return;
          const left = Math.max(0, limit - (Date.now() - startedAt));
          overlay.setTimeLeft(left / limit, left / 1000);
          if (left <= 0) settle(timeoutDecision(scene));
        }, TICK_MS);
      }
    });
  }
}
