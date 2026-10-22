// Corrida: an endless runner in the spirit of the browser dinosaur game. The hero
// runs, jumps over low obstacles and ducks under high ones. Questions work exactly
// like in Desvie do obstáculo: every BARRIERS_PER_QUESTION obstacles cleared the
// world pauses for a question; 3 lives, last chance, the heart, tap to resume and
// the 3-2-1 countdown all come from RunFlow / RunSceneBase. Movement here is
// hand-made (no arcade physics) so the jump arc and the hit boxes are exactly the
// ones tested in runnerRules.ts. No content strings here (ENG-03).
import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, INVULNERABLE_MS } from '../config';
import {
  GRAVITY,
  HERO_BOX,
  JUMP_VELOCITY,
  heroRect,
  nextGap,
  obstacleRect,
  overlaps,
  pickObstacle,
} from '../runnerRules';
import type { ObstacleKind } from '../runnerRules';
import { heroIdleFrame } from './BootScene';
import { RunSceneBase } from './RunSceneBase';
import { RunnerControls } from '../ui/RunnerControls';

type State = 'ready' | 'playing' | 'question' | 'ended';

interface Obstacle {
  sprite: Phaser.GameObjects.Image;
  kind: ObstacleKind;
  passed: boolean;
}

const HERO_X = 200;
const HERO_SCALE = 2.5;
const DUCK_SQUASH = 0.55; // vertical scale of the sprite while ducking
const FEET_OFFSET = 8; // the hero's feet are this far inside the ground band
const HIGH_HEART_HEIGHT = 130; // the heart floats at jump height

export class RunnerScene extends RunSceneBase {
  private hero!: Phaser.GameObjects.Sprite;
  private obstacles: Obstacle[] = [];
  private state: State = 'ready';
  private feetY = 0;
  private velocityY = 0;
  private ducking = false;
  private duckKey = false;
  private duckButton = false;
  private invulnerableUntil = 0;
  private lastObstacle: ObstacleKind | null = null;
  private nextGapPx = 0;
  private lastDust = 0;
  private controls: RunnerControls | null = null;

  constructor() {
    super('RunnerScene');
  }

  init(): void {
    this.resetBase();
    this.obstacles = [];
    this.state = 'ready';
    this.velocityY = 0;
    this.ducking = false;
    this.duckKey = false;
    this.duckButton = false;
    this.invulnerableUntil = 0;
    this.lastObstacle = null;
    this.nextGapPx = 0;
  }

  protected playerPosition(): { x: number; y: number } {
    return { x: HERO_X, y: this.feetY - HERO_BOX.standHeight / 2 };
  }

  private get floorY(): number {
    return this.groundTop + FEET_OFFSET;
  }

  create(): void {
    this.createWorld('Toque, clique ou Espaço para pular');
    this.feetY = this.floorY;

    this.hero = this.add
      .sprite(HERO_X, this.feetY, 'hero', heroIdleFrame('right'))
      .setOrigin(0.5, 1)
      .setScale(HERO_SCALE)
      .setDepth(10);

    const keyboard = this.input.keyboard!;
    keyboard.addCapture('SPACE,UP,DOWN');
    keyboard.on('keydown-SPACE', this.onJumpKey, this);
    keyboard.on('keydown-UP', this.onJumpKey, this);
    keyboard.on('keydown-W', this.onJumpKey, this);
    keyboard.on('keydown-DOWN', this.onDuckDown, this);
    keyboard.on('keydown-S', this.onDuckDown, this);
    keyboard.on('keyup-DOWN', this.onDuckUp, this);
    keyboard.on('keyup-S', this.onDuckUp, this);
    this.input.on('pointerdown', this.jump, this);

    // On touch screens: big buttons to jump and to hold for ducking.
    if (RunnerControls.isNeeded()) {
      const uiRoot = document.getElementById('ui-root');
      if (uiRoot) {
        this.controls = new RunnerControls(uiRoot, {
          onJump: () => this.jump(),
          onDuck: (held) => {
            this.duckButton = held;
          },
        });
      }
    }

    this.events.once('shutdown', this.handleShutdown, this);
    this.openIntro();
  }

  // ---- input --------------------------------------------------------------

  private onJumpKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    this.jump();
  }

  private onDuckDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    this.duckKey = true;
  }

  private onDuckUp(): void {
    this.duckKey = false;
  }

  private onGround(): boolean {
    return this.feetY >= this.floorY - 0.5;
  }

  private jump(): void {
    if (this.introOpen) return;
    if (this.state === 'ready') {
      this.state = 'playing';
      this.hint.setVisible(false);
      this.hero.anims.play('hero-walk-right', true);
      this.nextGapPx = 300;
      this.spawnObstacle(GAME_WIDTH + 60);
      return;
    }
    if (this.state !== 'playing' || !this.onGround() || this.ducking) return;
    this.velocityY = JUMP_VELOCITY;
    this.hero.anims.stop();
    this.hero.setFrame(heroIdleFrame('right'));
  }

  // ---- loop ---------------------------------------------------------------

  update(time: number, delta: number): void {
    if (this.state === 'ready') {
      this.scrollWorld(delta);
      return;
    }
    if (this.state !== 'playing') return;

    const dt = delta / 1000;
    const distance = this.scrollWorld(delta);
    this.stepHero(dt);
    this.emitDust(time);
    this.moveObstacles(distance);
    this.maybeSpawn();

    const invulnerable = time < this.invulnerableUntil;
    this.hero.setAlpha(invulnerable ? 0.5 + 0.5 * Math.sin(time / 60) ** 2 : 1);

    if (!invulnerable && this.hitSomething()) {
      void this.handleCollision(time);
      return;
    }
    this.checkPassed();
    this.checkHeart();
  }

  private stepHero(dt: number): void {
    const wantsDuck = this.duckKey || this.duckButton;
    const grounded = this.onGround();
    this.ducking = wantsDuck && grounded;

    if (!grounded || this.velocityY < 0) {
      this.velocityY += GRAVITY * dt;
      this.feetY = Math.min(this.floorY, this.feetY + this.velocityY * dt);
      if (this.feetY >= this.floorY) {
        this.feetY = this.floorY;
        this.velocityY = 0;
        if (!this.ducking) this.hero.anims.play('hero-walk-right', true);
      }
    }

    this.hero.y = this.feetY;
    this.hero.setScale(HERO_SCALE, this.ducking ? HERO_SCALE * DUCK_SQUASH : HERO_SCALE);
  }

  private emitDust(time: number): void {
    if (!this.onGround() || time - this.lastDust < 90) return;
    this.lastDust = time;
    const size = Phaser.Math.Between(3, 5);
    const dot = this.add
      .rectangle(HERO_X - 12, this.feetY - 3, size, size, COLORS.grayNeutral, 0.7)
      .setDepth(9);
    this.tweens.add({
      targets: dot,
      x: dot.x - 40,
      y: dot.y - Phaser.Math.Between(4, 14),
      alpha: 0,
      duration: 380,
      onComplete: () => dot.destroy(),
    });
  }

  // ---- obstacles ----------------------------------------------------------

  private spawnObstacle(x: number): void {
    const kind = pickObstacle(this.lastObstacle, Math.random);
    this.lastObstacle = kind;
    const bottom = this.groundTop - kind.lift;
    const sprite = this.add.image(x, bottom, kind.key).setOrigin(0.5, 1).setDepth(7);
    this.obstacles.push({ sprite, kind, passed: false });
    this.nextGapPx = nextGap(this.tuning.speed, Math.random);
    // The extra-life heart floats up high between obstacles: jump to catch it.
    if (!this.heart && this.flow.wantsHeart()) this.spawnHeartAt(x + this.nextGapPx / 2, this.groundTop - HIGH_HEART_HEIGHT);
  }

  private moveObstacles(distance: number): void {
    for (const obstacle of this.obstacles) obstacle.sprite.x -= distance;
    const first = this.obstacles[0];
    if (first && first.sprite.x + first.kind.width < -40) {
      first.sprite.destroy();
      this.obstacles.shift();
    }
  }

  private maybeSpawn(): void {
    const last = this.obstacles[this.obstacles.length - 1];
    if (!last || last.sprite.x <= GAME_WIDTH - this.nextGapPx) this.spawnObstacle(GAME_WIDTH + 60);
  }

  private hitSomething(): boolean {
    const hero = heroRect(HERO_X, this.feetY, this.ducking);
    return this.obstacles.some((o) => overlaps(hero, obstacleRect(o.sprite.x, this.groundTop, o.kind)));
  }

  private checkPassed(): void {
    for (const obstacle of this.obstacles) {
      if (!obstacle.passed && obstacle.sprite.x + obstacle.kind.width / 2 < HERO_X - HERO_BOX.width / 2) {
        obstacle.passed = true;
        if (this.flow.barrierPassed()) {
          void this.runQuestion();
          return;
        }
      }
    }
  }

  // ---- collisions and questions (same rules as Desvie do obstáculo) -------

  private async handleCollision(time: number): Promise<void> {
    const outcome = this.flow.collide();
    this.cameras.main.shake(180, 0.01);
    if (outcome === 'life-lost') {
      this.recover(time);
      return;
    }

    this.state = 'question';
    const result = await this.flow.askLastChance();
    if (!this.alive) return;
    if (result.gameOver) {
      this.state = 'ended';
      await this.endRun('gameover');
      return;
    }
    this.celebrate(18);
    await this.waitForTap();
    if (!this.alive) return;
    this.recover(this.time.now);
    await this.countdown();
    if (!this.alive) return;
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
    this.state = 'playing';
  }

  // After a hit: clear the obstacles right in front so one mistake is not two.
  private recover(time: number): void {
    for (const obstacle of [...this.obstacles]) {
      if (obstacle.sprite.x > HERO_X - 80 && obstacle.sprite.x < HERO_X + 320) {
        obstacle.sprite.destroy();
        this.obstacles = this.obstacles.filter((o) => o !== obstacle);
      }
    }
    this.feetY = this.floorY;
    this.velocityY = 0;
    this.invulnerableUntil = time + INVULNERABLE_MS;
  }

  private async runQuestion(): Promise<void> {
    this.state = 'question';
    this.hero.anims.stop();
    this.hero.setFrame(heroIdleFrame('right'));
    const result = await this.flow.askQuestion();

    if (result.gameOver) {
      this.state = 'ended';
      await this.endRun('gameover');
      return;
    }
    if (result.completed) {
      this.state = 'ended';
      await this.endRun('complete');
      return;
    }

    if (result.correct) this.celebrate(result.streak >= 3 ? 36 : 18);
    const before = this.tuning;
    this.tuning = this.flow.getTuning();
    const phaseUp = this.tuning.step > before.step;
    this.reactToAnswer(result.correct, result.streak, phaseUp);
    await this.waitForTap();
    if (!this.alive) return;
    if (this.tuning.speed > before.speed) this.announceSpeed(this.tuning);
    await this.countdown();
    if (!this.alive) return;
    this.recover(this.time.now);
    this.invulnerableUntil = this.time.now + 800;
    this.hero.anims.play('hero-walk-right', true);
    this.state = 'playing';
  }

  private handleShutdown(): void {
    this.alive = false;
    const keyboard = this.input.keyboard;
    keyboard?.off('keydown-SPACE', this.onJumpKey, this);
    keyboard?.off('keydown-UP', this.onJumpKey, this);
    keyboard?.off('keydown-W', this.onJumpKey, this);
    keyboard?.off('keydown-DOWN', this.onDuckDown, this);
    keyboard?.off('keydown-S', this.onDuckDown, this);
    keyboard?.off('keyup-DOWN', this.onDuckUp, this);
    keyboard?.off('keyup-S', this.onDuckUp, this);
    this.input.off('pointerdown', this.jump, this);
    for (const obstacle of this.obstacles) obstacle.sprite.destroy();
    this.obstacles = [];
    this.controls?.destroy();
    this.controls = null;
  }
}
