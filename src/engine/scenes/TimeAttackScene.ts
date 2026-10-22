// Contra o tempo: questions one after the other, each with a countdown that
// depends on how long the question is (see timeLimit.ts). There is no flying or
// running between questions, so this scene is mostly a backdrop with a clock; the
// question sheet, the timer bar and the rules (lives, XP, combo, saving) come from
// RunFlow and the shared overlay. A wrong answer or running out of time costs a
// life; the "Continuar" button is the tap that resumes. No content strings (ENG-03).
import { GAME_WIDTH } from '../config';
import { RunSceneBase } from './RunSceneBase';

const BEAT_MS = 450; // a short pause after each answer so the reaction can be seen

export class TimeAttackScene extends RunSceneBase {
  constructor() {
    super('TimeAttackScene');
  }

  init(): void {
    this.resetBase();
  }

  protected playerPosition(): { x: number; y: number } {
    return { x: GAME_WIDTH / 2, y: 300 };
  }

  create(): void {
    this.createWorld('');
    this.hint.setVisible(false);
    this.add.image(GAME_WIDTH / 2, 230, 'clock').setScale(2).setDepth(3).setAlpha(0.85);
    this.events.once('shutdown', () => {
      this.alive = false;
    });
    void this.loop();
  }

  update(_time: number, delta: number): void {
    // the far city drifts slowly so the backdrop is not frozen
    this.skyline.tilePositionX += (14 * delta) / 1000;
    this.ground.tilePositionX += (40 * delta) / 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private async loop(): Promise<void> {
    await this.flow.showIntro();
    if (!this.alive) return;
    await this.sleep(300);

    for (;;) {
      if (!this.alive) return;
      const result = await this.flow.askQuestion();
      if (!this.alive) return;
      if (result.gameOver) {
        await this.endRun('gameover');
        return;
      }
      if (result.completed) {
        await this.endRun('complete');
        return;
      }

      if (result.correct) this.celebrate(result.streak >= 3 ? 36 : 18);
      if (result.heart) {
        this.celebrate(14);
        this.floatText('+1 vida', GAME_WIDTH / 2, 160);
      }
      this.reactToAnswer(result.correct, result.streak, false);
      await this.sleep(BEAT_MS);
    }
  }
}
