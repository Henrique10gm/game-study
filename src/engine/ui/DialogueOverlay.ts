// DOM-only decision overlay (D-05, T-01-01). Built exclusively with element
// creation, textContent, classList, dataset and addEventListener — no markup-
// injection APIs anywhere in this file (guarded by tests/engine/dom-safety.test.ts).
// All copy that is NOT sourced from content/ (the UI-SPEC.md fixed strings) is
// allowed here; scenario text always comes from the DecisionSceneContent /
// DecisionOutcome arguments, never as a literal.
import './dialogue.css';
import { avatarFrameFor } from '../cast';
import { characterAvatar } from './avatar';
import { pixelBar } from './pixelBar';
import { ReportPanel } from './ReportPanel';
import type { ReportSubmit } from './ReportPanel';
import type { QuestionContent } from '../content/types';
import type { DecisionOutcome } from '../systems/ScoringSystem';

/** Where the player is in the run, shown above the question. */
export interface QuestionMeta {
  index: number; // 1-based position of this question
  total: number;
  streak: number; // correct answers in a row before this question
  lastChance?: boolean; // the extra question asked when the last life is hit
  timeLimitMs?: number; // Contra o tempo: shows a countdown bar
}

export class DialogueOverlay {
  private readonly root: HTMLElement;
  private section: HTMLElement | null = null;
  private timerFill: HTMLElement | null = null;
  private timerLabel: HTMLElement | null = null;
  private report: ReportPanel | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  showDecision(scene: QuestionContent, onChoose: (choiceId: string) => void, meta?: QuestionMeta): void {
    this.unmount();

    const section = document.createElement('section');
    section.dataset.testid = 'dialogue-overlay';
    section.className = 'dialogue-overlay';

    if (meta) {
      const head = document.createElement('div');
      head.className = 'dialogue-meta';
      head.dataset.testid = 'dialogue-meta';
      const tag = document.createElement('span');
      tag.className = 'px-tag';
      tag.textContent = meta.lastChance ? 'Última chance' : `Questão ${meta.index} de ${meta.total}`;
      head.appendChild(tag);
      if (!meta.lastChance) {
        head.appendChild(pixelBar((meta.index - 1) / meta.total, Math.min(12, meta.total), 'px-bar--thin'));
      } else {
        const hint = document.createElement('span');
        hint.className = 'dialogue-streak';
        hint.textContent = 'Acertou, continua. Errou, acabou.';
        head.appendChild(hint);
      }
      if (meta.streak >= 2) {
        const streak = document.createElement('span');
        streak.className = 'dialogue-streak';
        streak.textContent = `Combo ×${meta.streak}`;
        head.appendChild(streak);
      }
      section.appendChild(head);
    }

    if (meta?.timeLimitMs) section.appendChild(this.buildTimer(meta.timeLimitMs));

    const firstSpeaker = scene.dialogue[0]?.speaker ?? '';
    const speakerEl = document.createElement('div');
    speakerEl.dataset.testid = 'dialogue-speaker';
    speakerEl.className = 'dialogue-speaker';
    if (firstSpeaker) speakerEl.appendChild(characterAvatar(avatarFrameFor(firstSpeaker), 2));
    speakerEl.appendChild(document.createTextNode(firstSpeaker));
    section.appendChild(speakerEl);

    for (const line of scene.dialogue) {
      const lineEl = document.createElement('p');
      lineEl.dataset.testid = 'dialogue-line';
      lineEl.className = 'dialogue-line';
      if (line.speaker !== firstSpeaker) {
        const prefix = document.createElement('span');
        prefix.className = 'dialogue-line-speaker';
        prefix.textContent = line.speaker;
        lineEl.appendChild(prefix);
      }
      lineEl.appendChild(document.createTextNode(line.text));
      section.appendChild(lineEl);
    }

    const questionEl = document.createElement('p');
    questionEl.dataset.testid = 'dialogue-question';
    questionEl.className = 'dialogue-question';
    questionEl.textContent = scene.question;
    section.appendChild(questionEl);

    const choiceList = document.createElement('div');
    choiceList.className = 'choice-list';
    let firstButton: HTMLButtonElement | null = null;
    for (const choice of scene.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.testid = 'choice';
      button.dataset.choiceId = choice.id;
      button.className = 'choice-button';
      button.textContent = choice.text;
      button.addEventListener('click', () => onChoose(choice.id));
      choiceList.appendChild(button);
      firstButton = firstButton ?? button;
    }
    section.appendChild(choiceList);

    const hint = document.createElement('p');
    hint.className = 'dialogue-hint';
    hint.dataset.testid = 'dialogue-hint';
    hint.textContent = '↑ ↓ para escolher · Enter para confirmar';
    section.appendChild(hint);

    this.root.appendChild(section);
    this.section = section;
    firstButton?.focus();
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  // A focused button would be "clicked" by Space on key release: not here.
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!this.section || event.code !== 'Space' || this.report?.isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
  };

  // Keyboard: arrows move between the choices, Enter confirms the highlighted one
  // (and later moves on). Space does NOT answer: it is only kept away from the game
  // and from a focused button. Capture phase, so the game behind (↑ flaps, Space
  // jumps) never sees these keys while a question is open; a held Enter does not repeat.
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const section = this.section;
    if (!section || event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.report?.isOpen()) {
      // Report form: typing, Space and Enter work normally; the game behind still must not see them.
      event.stopPropagation();
      if (event.code === 'Escape') {
        event.preventDefault();
        this.report.close();
      }
      return;
    }
    const arrows = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
    const confirm = ['Enter', 'NumpadEnter'];
    if (!arrows.includes(event.code) && !confirm.includes(event.code) && event.code !== 'Space') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || event.code === 'Space') return;

    const next = section.querySelector<HTMLButtonElement>('[data-testid="btn-continue"]');
    if (next) {
      if (confirm.includes(event.code)) next.click(); // the answer is in: Enter moves on
      return;
    }

    const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]:not(:disabled)'));
    if (buttons.length === 0) return;
    const at = buttons.findIndex((button) => button === document.activeElement);
    if (confirm.includes(event.code)) {
      if (at >= 0) buttons[at].click();
      else buttons[0].focus();
      return;
    }
    const step = event.code === 'ArrowDown' || event.code === 'ArrowRight' ? 1 : -1;
    const target = at < 0 ? (step > 0 ? 0 : buttons.length - 1) : (at + step + buttons.length) % buttons.length;
    buttons[target].focus();
  };

  // Contra o tempo: a bar that empties, with the seconds left.
  private buildTimer(totalMs: number): HTMLElement {
    const box = document.createElement('div');
    box.className = 'dialogue-timer';
    box.dataset.testid = 'dialogue-timer';
    const bar = document.createElement('div');
    bar.className = 'dialogue-timer-bar';
    const fill = document.createElement('div');
    fill.className = 'dialogue-timer-fill';
    bar.appendChild(fill);
    const label = document.createElement('span');
    label.className = 'dialogue-timer-label';
    label.textContent = `${Math.ceil(totalMs / 1000)} s`;
    box.append(bar, label);
    this.timerFill = fill;
    this.timerLabel = label;
    return box;
  }

  /** Updates the countdown: fraction 1 = full time, 0 = out of time. */
  setTimeLeft(fraction: number, secondsLeft: number): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    if (this.timerFill) this.timerFill.style.width = `${clamped * 100}%`;
    if (this.timerLabel) this.timerLabel.textContent = `${Math.max(0, Math.ceil(secondsLeft))} s`;
    this.timerFill?.classList.toggle('is-low', clamped <= 0.2);
  }

  showFeedback(
    // Unused today — the overlay reads chosen/correct choice ids off `outcome`
    // and the already-rendered choice buttons. Kept in the signature to match
    // the interfaces contract in case a future plan needs the raw scene here.
    _scene: QuestionContent,
    outcome: DecisionOutcome,
    onContinue: () => void,
    onReport?: ReportSubmit,
  ): void {
    const section = this.section;
    if (!section) {
      throw new Error('showFeedback called without an active decision overlay');
    }

    const buttons = Array.from(
      section.querySelectorAll<HTMLButtonElement>('[data-testid="choice"]'),
    );
    for (const button of buttons) {
      button.disabled = true;
      const choiceId = button.dataset.choiceId;
      if (choiceId === outcome.correctChoiceId) {
        button.classList.add('choice-button--correct');
      } else if (choiceId === outcome.chosenChoiceId && !outcome.correct) {
        button.classList.add('choice-button--wrong');
      }
    }

    section.classList.add('is-answered'); // the scenario steps back, the feedback takes the eye
    const banner = document.createElement('div');
    banner.dataset.testid = 'feedback-banner';
    banner.classList.add('feedback-banner');
    if (outcome.correct) {
      banner.textContent = 'Correto!';
      banner.classList.add('feedback-banner--correct');
    } else if (outcome.timedOut) {
      banner.textContent = 'Tempo esgotado.';
      banner.classList.add('feedback-banner--wrong');
    } else {
      banner.textContent = 'Não foi dessa vez.';
      banner.classList.add('feedback-banner--wrong');
    }
    section.appendChild(banner);

    const feedbackText = document.createElement('p');
    feedbackText.dataset.testid = 'feedback-text';
    feedbackText.className = 'feedback-text';
    feedbackText.textContent = outcome.feedbackText;
    section.appendChild(feedbackText);

    if (outcome.xpEarned > 0) {
      const xpGain = document.createElement('div');
      xpGain.dataset.testid = 'xp-gain';
      xpGain.className = 'xp-gain';
      xpGain.textContent = `+${outcome.xpEarned} XP`;
      section.appendChild(xpGain);
    }

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.dataset.testid = 'btn-continue';
    continueBtn.className = 'btn-continue';
    continueBtn.textContent = 'Continuar';
    continueBtn.addEventListener('click', () => onContinue());
    section.appendChild(continueBtn);

    if (onReport) {
      // The form opens below the button; the keyboard belongs to it while it is open.
      this.report = new ReportPanel(section, onReport);
      section.insertBefore(this.report.toggle, continueBtn);
    }

    continueBtn.focus({ preventScroll: true });
    banner.scrollIntoView?.({ block: 'nearest' });
  }

  unmount(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    if (this.section) {
      this.section.remove();
      this.section = null;
    }
    this.timerFill = null;
    this.timerLabel = null;
    this.report = null;
  }
}
