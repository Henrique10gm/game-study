// Speed and gap tuning.
//  - The barriers get faster with EVERY correct answer (a wrong answer does not
//    slow them down), up to a cap that stays playable.
//  - The opening between barriers narrows every 5 questions answered, within a floor.
export interface LevelTuning {
  step: number; // 0-based gap step (every 5 questions answered)
  speed: number; // horizontal barrier speed, px/s
  speedPct: number; // speed relative to the start, in % (shown in the HUD)
  gap: number; // vertical opening between pipes, px
  spacing: number; // horizontal distance between barriers, px
}

export const BASE_SPEED = 170;
export const SPEED_PER_CORRECT = 14;
export const MAX_SPEED = 420; // reached after 18 correct answers

const QUESTIONS_PER_STEP = 5;
const MAX_STEP = 6;

export function levelTuning(questionsAnswered: number, correctAnswers: number): LevelTuning {
  const step = Math.min(MAX_STEP, Math.floor(Math.max(0, questionsAnswered) / QUESTIONS_PER_STEP));
  const speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_CORRECT * Math.max(0, correctAnswers));
  return {
    step,
    speed,
    speedPct: Math.round((speed / BASE_SPEED) * 100),
    gap: Math.max(150, 200 - 6 * step),
    spacing: 340,
  };
}
