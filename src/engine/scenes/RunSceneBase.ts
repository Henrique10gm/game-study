// What every run scene has in common (Desvie do obstáculo, Corrida): the night
// backdrop, the rules card before the run, the extra-life heart, confetti, the
// cast dropping by, the speed announcement, "tap to continue" after a question
// and the 3-2-1 countdown. The rules themselves (lives, last chance, XP, saving)
// live in RunFlow; subclasses only add their own physics, input and obstacles.
import Phaser from 'phaser';
import { pickCameo } from '../cast';
import type { CameoTrigger } from '../cast';
import { COLORS, FONT_SANS, FONT_SERIF, GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT } from '../config';
import { INK_ON_DARK, scene } from '../palette';
import { currentTheme } from '../theme';
import type { LevelTuning } from '../run/levelTuning';
import { MAX_SPEED } from '../run/levelTuning';
import type { RunFlow } from '../run/RunFlow';
import { spawnCameo } from './cameoActor';

export abstract class RunSceneBase extends Phaser.Scene {
  protected flow!: RunFlow;
  protected tuning!: LevelTuning;
  protected alive = true;
  protected introOpen = false;
  protected cameoActive = false;
  protected heart: Phaser.GameObjects.Image | null = null;

  protected ground!: Phaser.GameObjects.TileSprite;
  protected skyline!: Phaser.GameObjects.TileSprite;
  protected hint!: Phaser.GameObjects.Text;
  protected resumeHint!: Phaser.GameObjects.Text;
  protected banner!: Phaser.GameObjects.Text;
  protected groundTop = GAME_HEIGHT - GROUND_HEIGHT;
  // Text colors for this run: the theme's ink over a sky, light over a dark board (the maze).
  protected inkColor = INK_ON_DARK;
  protected accentColor = '#D2F58C';

  /** Where the player is: confetti and the heart pickup use it. */
  protected abstract playerPosition(): { x: number; y: number };

  protected resetBase(): void {
    this.alive = true;
    this.introOpen = false;
    this.cameoActive = false;
    this.heart = null;
  }

  /** Sky, stars, moon, far city, ground and the three text lines (`backdrop: false` = only the sky colour and the text lines). */
  protected createWorld(hintText: string, backdrop = true): void {
    this.flow = this.registry.get('runFlow') as RunFlow;
    this.tuning = this.flow.getTuning();

    const P = scene();
    this.cameras.main.setBackgroundColor(P.skyRun);
    this.inkColor = backdrop ? P.ink : INK_ON_DARK;
    this.accentColor = backdrop ? P.accentText : '#D2F58C';
    if (backdrop) {
      if (P.isDay) this.makeSunAndClouds();
      else {
        this.makeStars();
        this.makeMoon();
      }

      // Far city drifting slower than the foreground (parallax).
      this.skyline = this.add
        .tileSprite(0, this.groundTop - 220, GAME_WIDTH, 220, `skyline-${currentTheme()}`)
        .setOrigin(0, 0)
        .setDepth(1);
      this.ground = this.add
        .tileSprite(0, this.groundTop, GAME_WIDTH, GROUND_HEIGHT, `ground-${currentTheme()}`)
        .setOrigin(0, 0)
        .setDepth(5);
    }

    const textStyle = {
      fontFamily: FONT_SANS,
      fontSize: '24px',
      wordWrap: { width: GAME_WIDTH - 120 },
      fontStyle: '600',
      color: this.inkColor,
      align: 'center',
    };
    this.hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, `${this.flow.getModeTitle()}\n${hintText}`, textStyle)
      .setOrigin(0.5)
      .setDepth(20);
    this.resumeHint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Toque, clique ou Espaço para continuar', textStyle)
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    this.banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', { ...textStyle, fontSize: '64px' })
      .setOrigin(0.5)
      .setDepth(20);
  }

  /** Brief rules card before every run (skippable); the run waits for it. */
  protected openIntro(): void {
    this.introOpen = true;
    this.hint.setVisible(false);
    void this.flow.showIntro().then(() => {
      if (!this.alive) return;
      // let the key press that closed the card die out before it can act
      this.time.delayedCall(150, () => {
        this.introOpen = false;
        this.hint.setVisible(true);
      });
    });
  }

  protected scrollWorld(delta: number): number {
    const distance = (this.tuning.speed * delta) / 1000;
    this.ground.tilePositionX += distance;
    this.skyline.tilePositionX += distance * 0.18;
    if (this.heart) this.heart.x -= distance;
    return distance;
  }

  // ---- the extra-life heart ----------------------------------------------

  protected spawnHeartAt(x: number, y: number): void {
    const heart = this.add.image(x, y, 'heart').setDepth(8).setScale(1.2);
    this.tweens.add({ targets: heart, scale: 1.45, duration: 380, yoyo: true, repeat: -1 });
    this.heart = heart;
    this.flow.markHeartSpawned();
  }

  protected checkHeart(): void {
    const heart = this.heart;
    if (!heart) return;
    if (heart.x < -40) {
      this.removeHeart();
      return;
    }
    const player = this.playerPosition();
    if (Phaser.Math.Distance.Between(player.x, player.y, heart.x, heart.y) > 34) return;
    if (this.flow.gainLife()) {
      this.celebrate(14);
      this.floatText('+1 vida', heart.x, heart.y - 30);
    }
    this.removeHeart();
  }

  protected removeHeart(): void {
    if (!this.heart) return;
    this.tweens.killTweensOf(this.heart);
    this.heart.destroy();
    this.heart = null;
  }

  protected floatText(text: string, x: number, y: number): void {
    const label = this.add
      .text(x, y, text, { fontFamily: FONT_SERIF, fontSize: '28px', color: this.accentColor })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      y: label.y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => label.destroy(),
    });
  }

  // ---- effects and cast ---------------------------------------------------

  // Square confetti in brand colors bursting from the player.
  protected celebrate(count: number): void {
    const origin = this.playerPosition();
    const palette = [COLORS.lime, COLORS.paper, COLORS.white];
    for (let i = 0; i < count; i++) {
      const size = Phaser.Math.Between(4, 8);
      const piece = this.add.rectangle(origin.x, origin.y, size, size, palette[i % palette.length]).setDepth(30);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(60, 180);
      this.tweens.add({
        targets: piece,
        x: piece.x + Math.cos(angle) * distance,
        y: piece.y + Math.sin(angle) * distance,
        alpha: 0,
        duration: Phaser.Math.Between(500, 800),
        ease: 'Cubic.easeOut',
        onComplete: () => piece.destroy(),
      });
    }
  }

  // The office reacts now and then: not after every answer, so it stays a surprise.
  protected reactToAnswer(correct: boolean, streak: number, phaseUp: boolean): void {
    if (phaseUp) this.showCameo('phase');
    else if (correct && streak >= 3 && streak % 2 === 1) this.showCameo('streak');
    else if (correct && Math.random() < 0.25) this.showCameo('correct');
    else if (!correct && Math.random() < 0.6) this.showCameo('wrong');
  }

  protected showCameo(trigger: CameoTrigger): void {
    if (this.cameoActive) return;
    this.cameoActive = true;
    spawnCameo(this, pickCameo(trigger), {
      x: GAME_WIDTH - 150,
      y: this.groundTop + GROUND_HEIGHT - 12,
      depth: 6,
      durationMs: 2000,
      onDone: () => {
        this.cameoActive = false;
      },
    });
  }

  // After each correct answer the world gets faster: say so (above the countdown).
  protected announceSpeed(tuning: LevelTuning): void {
    const text = tuning.speed >= MAX_SPEED ? 'Velocidade máxima' : `Mais rápido: ${tuning.speedPct}%`;
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, text, {
        fontFamily: FONT_SERIF,
        fontSize: '36px',
        color: this.accentColor,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      y: label.y - 30,
      alpha: 0,
      delay: 900,
      duration: 700,
      onComplete: () => label.destroy(),
    });
  }

  // ---- pause and resume ---------------------------------------------------

  // Paused until a tap, click or key press (a short guard ignores the click that closed the feedback).
  protected waitForTap(): Promise<void> {
    return new Promise((resolve) => {
      this.resumeHint.setVisible(true);
      const readyAt = this.time.now + 350;
      const keyboard = this.input.keyboard;
      const done = (): void => {
        if (this.time.now < readyAt) return;
        this.input.off('pointerdown', done);
        keyboard?.off('keydown-SPACE', onKey);
        keyboard?.off('keydown-UP', onKey);
        keyboard?.off('keydown-ENTER', onKey);
        this.resumeHint.setVisible(false);
        resolve();
      };
      const onKey = (event: KeyboardEvent): void => {
        if (!event.repeat) done();
      };
      this.input.on('pointerdown', done);
      keyboard?.on('keydown-SPACE', onKey);
      keyboard?.on('keydown-UP', onKey);
      keyboard?.on('keydown-ENTER', onKey);
    });
  }

  // 3, 2, 1: one second each.
  protected countdown(): Promise<void> {
    return new Promise((resolve) => {
      let remaining = 3;
      this.banner.setText(String(remaining));
      const timer = this.time.addEvent({
        delay: 1000,
        repeat: 2,
        callback: () => {
          remaining -= 1;
          if (remaining > 0) {
            this.banner.setText(String(remaining));
          } else {
            this.banner.setText('');
            timer.remove();
            resolve();
          }
        },
      });
    });
  }

  // The app decides what happens next (play again / back to the menu).
  protected async endRun(kind: 'gameover' | 'complete'): Promise<void> {
    const action = await this.flow.finishRun(kind);
    if (!this.alive) return;
    this.game.events.emit('run-finished', action);
  }

  // ---- backdrop -----------------------------------------------------------

  protected makeStars(): void {
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, this.groundTop - 220);
      const size = Phaser.Math.Between(1, 3);
      const star = this.add
        .rectangle(x, y, size, size, COLORS.white, Phaser.Math.FloatBetween(0.25, 0.8))
        .setDepth(0);
      if (i % 4 === 0) {
        this.tweens.add({
          targets: star,
          alpha: 0.1,
          duration: Phaser.Math.Between(900, 1800),
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  // By day: the sun in the upper right and a few clouds drifting slowly.
  protected makeSunAndClouds(): void {
    const P = scene();
    const g = this.add.graphics().setDepth(0);
    const cx = GAME_WIDTH - 130;
    const cy = 110;
    g.fillStyle(P.sun, 0.25).fillCircle(cx, cy, 70).fillStyle(P.sun, 0.35).fillCircle(cx, cy, 54);
    const r = 4;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + 1) g.fillStyle(P.sun).fillRect(cx + x * 8 - 4, cy + y * 8 - 4, 8, 8);
      }
    }
    [[120, 70, 1], [420, 130, 0.8], [640, 60, 1.1]].forEach(([x, y, size], i) => {
      const u = Math.round(8 * size);
      const cloud = this.add.graphics().setDepth(0).setPosition(x, y);
      cloud.fillStyle(P.cloud, 0.92);
      cloud.fillRect(0, u * 2, u * 9, u).fillRect(u, u, u * 7, u).fillRect(u * 3, 0, u * 3, u).fillRect(u * 6, u, u * 2, u);
      this.tweens.add({ targets: cloud, x: x + 60 + i * 20, duration: 24000 + i * 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // A pixel-art moon (stepped disc) in the upper right.
  protected makeMoon(): void {
    const g = this.add.graphics().setDepth(0);
    const cx = GAME_WIDTH - 130;
    const cy = 110;
    const r = 5; // in blocks of 8 px
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + 1) g.fillStyle(COLORS.paper, 0.95).fillRect(cx + x * 8, cy + y * 8, 8, 8);
      }
    }
    // craters
    g.fillStyle(COLORS.grayNeutral).fillRect(cx - 16, cy - 8, 8, 8).fillRect(cx + 8, cy + 16, 16, 8);
  }
}
