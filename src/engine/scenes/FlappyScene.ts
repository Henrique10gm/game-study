// Desvie do obstáculo: one-button flight through column barriers.
// Every BARRIERS_PER_QUESTION barriers the world pauses and RunFlow opens a
// question overlay. Rules (lives, last chance, saving) live in RunFlow and the
// parts shared with the other run scenes in RunSceneBase; this scene only does
// its physics, input and obstacles. No content strings here (ENG-03).
//
// Input lock uses a local state flag — never `input.keyboard.enabled` — so key
// state keeps updating while a question is open (stale-key bug from the RPG
// MapScene, see .planning/debug/player-auto-walks-after-dialogue.md).
import Phaser from 'phaser';
import {
  BARRIER_WIDTH,
  BIRD_GRAVITY,
  BIRD_X,
  COLORS,
  FLAP_VELOCITY,
  GAME_HEIGHT,
  GAME_WIDTH,
  INVULNERABLE_MS,
} from '../config';
import { CEILING_HITS_FOR_EGG } from '../easterEggs';
import { RunSceneBase } from './RunSceneBase';

type State = 'ready' | 'playing' | 'question' | 'ended';

interface Barrier {
  top: Phaser.GameObjects.TileSprite;
  bottom: Phaser.GameObjects.TileSprite;
  topCap: Phaser.GameObjects.Image;
  bottomCap: Phaser.GameObjects.Image;
  gapY: number;
  passed: boolean;
}

const CAP_HEIGHT = 28;
const MIN_GAP_TOP = 110;

export class FlappyScene extends RunSceneBase {
  private bird!: Phaser.Physics.Arcade.Sprite;
  private lastTrail = 0;
  private ceilingHits = 0;
  private atCeiling = false;
  private barriers: Barrier[] = [];
  private state: State = 'ready';
  private invulnerableUntil = 0;

  constructor() {
    super('FlappyScene');
  }

  init(): void {
    this.resetBase();
    this.barriers = [];
    this.state = 'ready';
    this.invulnerableUntil = 0;
    this.ceilingHits = 0;
    this.atCeiling = false;
  }

  protected playerPosition(): { x: number; y: number } {
    return { x: this.bird.x, y: this.bird.y };
  }

  create(): void {
    this.createWorld('Toque, clique ou Espaço para voar');

    // The player is the coin the character kicked in the menu.
    this.bird = this.physics.add.sprite(BIRD_X, GAME_HEIGHT / 2, 'coin', 0);
    this.bird.setScale(2).setDepth(10);
    this.bird.play('coin-spin');
    this.bird.body!.setSize(16, 16).setOffset(4, 4);
    this.bird.setGravityY(BIRD_GRAVITY);
    (this.bird.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.input.keyboard!.addCapture('SPACE,UP');
    this.input.keyboard!.on('keydown-SPACE', this.handleFlapKey, this);
    this.input.keyboard!.on('keydown-UP', this.handleFlapKey, this);
    this.input.on('pointerdown', this.flap, this);

    this.events.once('shutdown', this.handleShutdown, this);
    this.openIntro();
  }

  private handleFlapKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    this.flap();
  }

  private flap(): void {
    if (this.introOpen) return;
    if (this.state === 'ready') {
      this.state = 'playing';
      this.hint.setVisible(false);
      (this.bird.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      this.spawnBarrier(GAME_WIDTH + 80);
    }
    if (this.state !== 'playing') return;
    this.bird.setVelocityY(FLAP_VELOCITY);
  }

  update(time: number, delta: number): void {
    if (this.state === 'ready') {
      this.bird.y = GAME_HEIGHT / 2 + Math.sin(time / 260) * 8;
      this.scrollWorld(delta);
      return;
    }
    if (this.state !== 'playing') return;

    this.scrollWorld(delta);
    this.emitTrail(time);
    if (this.bird.y < 0) {
      this.bird.y = 0;
      this.bird.setVelocityY(0);
      // Easter egg: bumping the ceiling over and over.
      if (!this.atCeiling) {
        this.atCeiling = true;
        this.ceilingHits += 1;
        if (this.ceilingHits === CEILING_HITS_FOR_EGG) this.showCameo('ceiling');
      }
    } else if (this.bird.y > 40) {
      this.atCeiling = false;
    }

    this.moveBarriers();
    this.maybeSpawnBarrier();

    const invulnerable = time < this.invulnerableUntil;
    this.bird.setAlpha(invulnerable ? 0.5 + 0.5 * Math.sin(time / 60) ** 2 : 1);

    if (!invulnerable && this.hitSomething()) {
      void this.handleCollision(time);
      return;
    }

    this.checkBarrierPassed();
    this.checkHeart();
  }

  // Little lime squares left behind by the coin.
  private emitTrail(time: number): void {
    if (time - this.lastTrail < 70) return;
    this.lastTrail = time;
    const size = Phaser.Math.Between(3, 5);
    const dot = this.add
      .rectangle(this.bird.x - 14, this.bird.y + Phaser.Math.Between(-4, 4), size, size, COLORS.lime, 0.8)
      .setDepth(9);
    this.tweens.add({
      targets: dot,
      x: dot.x - 60,
      alpha: 0,
      duration: 420,
      onComplete: () => dot.destroy(),
    });
  }

  // Pipes are moved by their arcade bodies (velocity); caps just follow the pipe.
  private moveBarriers(): void {
    for (const barrier of this.barriers) {
      barrier.topCap.x = barrier.top.x;
      barrier.bottomCap.x = barrier.bottom.x;
    }
    const first = this.barriers[0];
    if (first && first.top.x + BARRIER_WIDTH < -40) {
      this.destroyBarrier(first);
      this.barriers.shift();
    }
  }

  private maybeSpawnBarrier(): void {
    const last = this.barriers[this.barriers.length - 1];
    if (!last || last.top.x <= GAME_WIDTH - this.tuning.spacing + BARRIER_WIDTH / 2) {
      this.spawnBarrier(GAME_WIDTH + BARRIER_WIDTH);
    }
  }

  private spawnBarrier(x: number): void {
    const gap = this.tuning.gap;
    const minY = MIN_GAP_TOP + gap / 2;
    const maxY = this.groundTop - 80 - gap / 2;
    const gapY = Phaser.Math.Between(minY, maxY);

    const topHeight = gapY - gap / 2;
    const bottomTop = gapY + gap / 2;
    const bottomHeight = this.groundTop - bottomTop;

    const top = this.add.tileSprite(x, topHeight / 2, BARRIER_WIDTH, topHeight, 'pipe').setDepth(2);
    const bottom = this.add.tileSprite(x, bottomTop + bottomHeight / 2, BARRIER_WIDTH, bottomHeight, 'pipe').setDepth(2);
    const topCap = this.add.image(x, topHeight - CAP_HEIGHT / 2, 'pipe-cap').setDepth(3);
    const bottomCap = this.add.image(x, bottomTop + CAP_HEIGHT / 2, 'pipe-cap').setDepth(3);
    this.physics.add.existing(top);
    this.physics.add.existing(bottom);
    for (const pipe of [top, bottom]) {
      (pipe.body as Phaser.Physics.Arcade.Body)
        .setImmovable(true)
        .setAllowGravity(false)
        .setVelocityX(-this.tuning.speed);
    }

    this.barriers.push({ top, bottom, topCap, bottomCap, gapY, passed: false });
    // The extra-life heart floats in the opening of a barrier, once, mid-run.
    if (!this.heart && this.flow.wantsHeart()) this.spawnHeartAt(x, gapY);
  }

  private destroyBarrier(barrier: Barrier): void {
    barrier.top.destroy();
    barrier.bottom.destroy();
    barrier.topCap.destroy();
    barrier.bottomCap.destroy();
  }

  private hitSomething(): boolean {
    if (this.bird.y + this.bird.displayHeight / 2 - 6 >= this.groundTop) return true;
    for (const barrier of this.barriers) {
      if (this.physics.overlap(this.bird, [barrier.top, barrier.bottom])) return true;
    }
    return false;
  }

  private checkBarrierPassed(): void {
    for (const barrier of this.barriers) {
      if (!barrier.passed && barrier.top.x + BARRIER_WIDTH / 2 < BIRD_X) {
        barrier.passed = true;
        if (this.flow.barrierPassed()) {
          void this.runQuestion();
          return;
        }
      }
    }
  }

  private async handleCollision(time: number): Promise<void> {
    const outcome = this.flow.collide();
    this.cameras.main.shake(180, 0.01);
    if (outcome === 'life-lost') {
      this.respawn(time);
      return;
    }

    // Last life: a last-chance question decides. Right = keep going, wrong = over.
    this.state = 'question';
    this.physics.pause();
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
    this.respawn(this.time.now);
    await this.countdown();
    if (!this.alive) return;
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
    this.physics.resume();
    this.state = 'playing';
  }

  // Put the bird back in the next opening so a hit doesn't chain into a second one.
  private respawn(time: number): void {
    const next = this.barriers.find((b) => b.top.x + BARRIER_WIDTH / 2 >= BIRD_X - 20);
    this.bird.setPosition(BIRD_X, next ? next.gapY : GAME_HEIGHT / 2);
    this.bird.setVelocity(0, 0);
    this.invulnerableUntil = time + INVULNERABLE_MS;
  }

  private async runQuestion(): Promise<void> {
    this.state = 'question';
    this.physics.pause();
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
    this.applyTuning();
    const phaseUp = this.tuning.step > before.step;
    this.reactToAnswer(result.correct, result.streak, phaseUp);
    // The game stays paused until the player taps; then a 3 s countdown.
    await this.waitForTap();
    if (!this.alive) return;
    if (this.tuning.speed > before.speed) this.announceSpeed(this.tuning);
    await this.countdown();
    if (!this.alive) return;
    this.bird.setVelocityY(0);
    this.invulnerableUntil = this.time.now + 800;
    this.physics.resume();
    this.state = 'playing';
  }

  // Difficulty rises with the questions answered: re-speed the pipes already on screen.
  private applyTuning(): void {
    this.tuning = this.flow.getTuning();
    for (const barrier of this.barriers) {
      for (const pipe of [barrier.top, barrier.bottom]) {
        (pipe.body as Phaser.Physics.Arcade.Body).setVelocityX(-this.tuning.speed);
      }
    }
  }

  private handleShutdown(): void {
    this.alive = false;
    this.input.keyboard?.off('keydown-SPACE', this.handleFlapKey, this);
    this.input.keyboard?.off('keydown-UP', this.handleFlapKey, this);
    this.input.off('pointerdown', this.flap, this);
    for (const barrier of this.barriers) this.destroyBarrier(barrier);
    this.barriers = [];
  }
}
