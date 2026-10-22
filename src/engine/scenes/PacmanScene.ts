// Fuja dos ladrões: a Pac-Man style maze. The hero walks the maze, grabs the coins
// and runs from the thieves in striped shirts. Every COINS_PER_QUESTION coins the
// world pauses for a question; lives, last chance, the heart, XP, tap to resume
// and the 3-2-1 countdown come from RunFlow / RunSceneBase, exactly as in the
// other styles. Movement is cell to cell (pacmanMaze.ts, tested without a
// browser). No content strings here (ENG-03).
import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, INVULNERABLE_MS, TILE_SIZE } from '../config';
import {
  DELTA,
  HERO_SPEED,
  HERO_START,
  MAZE_COLS,
  MAZE_ROWS,
  OPPOSITE,
  COIN_SPAWN_MS,
  MAX_COINS_ON_BOARD,
  THIEF_STARTS,
  advanceActor,
  canMove,
  chaseChance,
  chooseThiefDirection,
  isWall,
  manhattan,
  openCells,
  pickCoinCell,
  reverseActor,
  thiefCount,
  thiefSpeed,
} from '../pacmanMaze';
import type { Actor, Cell, Direction } from '../pacmanMaze';
import { heroIdleFrame } from './BootScene';
import type { HeroView } from './BootScene';
import { RunSceneBase } from './RunSceneBase';

type State = 'ready' | 'playing' | 'question' | 'ended';

interface Thief extends Actor {
  sprite: Phaser.GameObjects.Image;
  index: number;
  active: boolean;
  releaseAt: number; // play time (ms) when it leaves its starting cell
  heading: Direction;
}

const TILE = TILE_SIZE;
const ORIGIN_X = (GAME_WIDTH - MAZE_COLS * TILE) / 2;
const ORIGIN_Y = GAME_HEIGHT - MAZE_ROWS * TILE - 16;
const HERO_SCALE = 0.9;
const COIN_SCALE = 0.85;
const CATCH_DISTANCE = 22; // px between hero and thief centres
const PICKUP_DISTANCE = 12; // px from a coin's centre
const RELEASE_STAGGER_MS = 2200;
const SWIPE_PX = 26;
const HERO_VIEW: Record<Direction, HeroView> = { left: 'left', right: 'right', up: 'back', down: 'front' };
// How hard each thief chases, relative to the run's chase chance: one is relentless, one wanders.
const CHASE_FACTOR = [1.15, 1, 0.8, 0.45] as const;

// Arrow keys and WASD, by physical key.
const CODE_DIRECTION: Record<string, Direction> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};
const PHASER_KEYS = ['LEFT', 'A', 'RIGHT', 'D', 'UP', 'W', 'DOWN', 'S'] as const;

function center(cell: Cell): { x: number; y: number } {
  return { x: ORIGIN_X + cell.col * TILE + TILE / 2, y: ORIGIN_Y + cell.row * TILE + TILE / 2 };
}

function pixelOf(actor: Actor): { x: number; y: number } {
  const c = center(actor.cell);
  if (!actor.dir) return c;
  const d = DELTA[actor.dir];
  return { x: c.x + d.col * actor.t, y: c.y + d.row * actor.t };
}

export class PacmanScene extends RunSceneBase {
  private hero!: Phaser.GameObjects.Sprite;
  private heroActor: Actor = { cell: HERO_START, dir: null, t: 0 };
  private wantDir: Direction | null = null;
  private facing: Direction = 'down';
  private thieves: Thief[] = [];
  private coins = new Map<string, Phaser.GameObjects.Sprite>();
  private nextCoinAt = 0; // play time (ms) of the next coin
  private state: State = 'ready';
  private playTime = 0;
  private invulnerableUntil = 0;
  private swipeFrom: { x: number; y: number } | null = null;

  constructor() {
    super('PacmanScene');
  }

  init(): void {
    this.resetBase();
    this.heroActor = { cell: HERO_START, dir: null, t: 0 };
    this.wantDir = null;
    this.facing = 'down';
    this.thieves = [];
    this.coins = new Map();
    this.nextCoinAt = 0;
    this.state = 'ready';
    this.playTime = 0;
    this.invulnerableUntil = 0;
    this.swipeFrom = null;
  }

  protected playerPosition(): { x: number; y: number } {
    return pixelOf(this.heroActor);
  }

  create(): void {
    this.createWorld('Setas, WASD ou deslize para fugir', false);
    // the maze is busy: dark outlines keep the messages readable over it
    for (const text of [this.hint, this.resumeHint, this.banner]) text.setStroke('#1A1615', 8);
    this.drawMaze();

    const start = center(HERO_START);
    this.hero = this.add
      .sprite(start.x, start.y, 'hero', heroIdleFrame('front'))
      .setScale(HERO_SCALE)
      .setDepth(10);

    this.thieves = THIEF_STARTS.map((cell, index) => {
      const at = center(cell);
      const sprite = this.add.image(at.x, at.y, 'thief-a').setDepth(9);
      return { cell, dir: null, t: 0, sprite, index, active: false, releaseAt: 0, heading: 'left' as Direction };
    });
    this.syncThieves(true);

    const keyboard = this.input.keyboard!;
    keyboard.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    for (const key of PHASER_KEYS) keyboard.on(`keydown-${key}`, this.onDirectionKey, this);
    keyboard.on('keydown-SPACE', this.onStartKey, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    this.events.once('shutdown', this.handleShutdown, this);
    this.openIntro();
  }

  // ---- drawing -------------------------------------------------------------

  // Dark walls with a lime edge wherever a wall meets a path.
  private drawMaze(): void {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x100d0c).fillRect(ORIGIN_X, ORIGIN_Y, MAZE_COLS * TILE, MAZE_ROWS * TILE);
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (!isWall(col, row)) continue;
        const x = ORIGIN_X + col * TILE;
        const y = ORIGIN_Y + row * TILE;
        g.fillStyle(COLORS.forest).fillRect(x, y, TILE, TILE);
        g.fillStyle(COLORS.petrol).fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
      }
    }
    g.lineStyle(3, COLORS.lime, 0.7);
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (!isWall(col, row)) continue;
        const x = ORIGIN_X + col * TILE;
        const y = ORIGIN_Y + row * TILE;
        if (!isWall(col, row - 1) && row > 0) g.lineBetween(x, y, x + TILE, y);
        if (!isWall(col, row + 1) && row < MAZE_ROWS - 1) g.lineBetween(x, y + TILE, x + TILE, y + TILE);
        if (!isWall(col - 1, row) && col > 0) g.lineBetween(x, y, x, y + TILE);
        if (!isWall(col + 1, row) && col < MAZE_COLS - 1) g.lineBetween(x + TILE, y, x + TILE, y + TILE);
      }
    }
  }

  // Coins come one at a time as the run goes on (few on the board), not all at once.
  private maybeSpawnCoin(): void {
    if (this.coins.size >= MAX_COINS_ON_BOARD || this.playTime < this.nextCoinAt) return;
    const taken = [...this.coins.keys()].map((k) => {
      const [col, row] = k.split(',').map(Number);
      return { col, row };
    });
    const cell = pickCoinCell(
      taken,
      this.heroTarget(),
      this.thieves.filter((t) => t.active).map((t) => t.cell),
    );
    this.nextCoinAt = this.playTime + COIN_SPAWN_MS;
    if (!cell) return;
    const at = center(cell);
    const coin = this.add.sprite(at.x, at.y, 'coin', 0).setScale(0).setDepth(4);
    coin.play('coin-spin');
    this.tweens.add({ targets: coin, scale: COIN_SCALE, duration: 220, ease: 'Back.easeOut' });
    this.coins.set(`${cell.col},${cell.row}`, coin);
  }

  // ---- input ---------------------------------------------------------------

  private onDirectionKey(event: KeyboardEvent): void {
    if (this.introOpen || this.state === 'question' || this.state === 'ended') return;
    const direction = CODE_DIRECTION[event.code];
    if (direction) this.steer(direction);
  }

  private onStartKey(event: KeyboardEvent): void {
    if (event.repeat || this.introOpen) return;
    this.begin();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.introOpen) return;
    this.swipeFrom = { x: pointer.x, y: pointer.y };
    this.begin();
  }

  // Swipe: as soon as the finger has moved far enough, that is the direction.
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || !this.swipeFrom || this.state !== 'playing') return;
    const dx = pointer.x - this.swipeFrom.x;
    const dy = pointer.y - this.swipeFrom.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    this.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    this.swipeFrom = { x: pointer.x, y: pointer.y };
  }

  private onPointerUp(): void {
    this.swipeFrom = null;
  }

  private begin(): void {
    if (this.state !== 'ready') return;
    this.state = 'playing';
    this.hint.setVisible(false);
  }

  private steer(direction: Direction): void {
    this.wantDir = direction;
    this.begin();
  }

  // ---- loop ----------------------------------------------------------------

  update(time: number, delta: number): void {
    if (this.state !== 'playing') return;
    const dt = Math.min(delta, 50) / 1000; // a slow frame must not let anyone jump through a wall
    this.playTime += dt * 1000;

    this.stepHero(dt);
    this.stepThieves(dt);
    this.pickCoin();
    this.maybeSpawnCoin();
    this.maybeSpawnHeart();

    const invulnerable = time < this.invulnerableUntil;
    this.hero.setAlpha(invulnerable ? 0.5 + 0.5 * Math.sin(time / 60) ** 2 : 1);
    this.checkHeart();

    if (!invulnerable && this.caught()) void this.handleCollision();
  }

  private stepHero(dt: number): void {
    const hero = this.heroActor;
    if (this.wantDir && hero.dir && this.wantDir === OPPOSITE[hero.dir]) reverseActor(hero, TILE);
    advanceActor(hero, HERO_SPEED * dt, TILE, (cell, current) => {
      if (this.wantDir && canMove(cell, this.wantDir)) return this.wantDir;
      if (current && canMove(cell, current)) return current;
      return null;
    });

    const at = pixelOf(hero);
    this.hero.setPosition(at.x, at.y);
    if (hero.dir) {
      this.facing = hero.dir;
      this.hero.anims.play(`hero-walk-${HERO_VIEW[hero.dir]}`, true);
    } else {
      this.hero.anims.stop();
      this.hero.setFrame(heroIdleFrame(HERO_VIEW[this.facing]));
    }
  }

  private stepThieves(dt: number): void {
    const speed = thiefSpeed(this.tuning.speedPct);
    const chase = chaseChance(this.tuning.step * 5);
    const target = this.heroTarget();
    for (const thief of this.thieves) {
      if (!thief.active) continue;
      if (this.playTime >= thief.releaseAt) {
        const ownChase = Math.min(0.95, chase * CHASE_FACTOR[thief.index % CHASE_FACTOR.length]);
        // The second thief aims where the hero is going, not where it is.
        const aim = thief.index === 1 ? this.heroAhead(3) : target;
        advanceActor(thief, speed * dt, TILE, (cell, current) => {
          const next = chooseThiefDirection(cell, current ?? thief.heading, aim, ownChase);
          thief.heading = next;
          return next;
        });
      }
      const at = pixelOf(thief);
      thief.sprite.setPosition(at.x, at.y);
      thief.sprite.setTexture(Math.floor(this.playTime / 170) % 2 === 0 ? 'thief-a' : 'thief-b');
      if (thief.dir === 'left') thief.sprite.setFlipX(true);
      else if (thief.dir === 'right') thief.sprite.setFlipX(false);
    }
  }

  private heroTarget(): Cell {
    const hero = this.heroActor;
    return hero.dir && hero.t > TILE / 2 ? { col: hero.cell.col + DELTA[hero.dir].col, row: hero.cell.row + DELTA[hero.dir].row } : hero.cell;
  }

  private heroAhead(cells: number): Cell {
    const base = this.heroTarget();
    const d = DELTA[this.facing];
    return { col: base.col + d.col * cells, row: base.row + d.row * cells };
  }

  private pickCoin(): void {
    const at = pixelOf(this.heroActor);
    const col = Math.round((at.x - ORIGIN_X - TILE / 2) / TILE);
    const row = Math.round((at.y - ORIGIN_Y - TILE / 2) / TILE);
    const key = `${col},${row}`;
    const coin = this.coins.get(key);
    if (!coin) return;
    const there = center({ col, row });
    if (Phaser.Math.Distance.Between(at.x, at.y, there.x, there.y) > PICKUP_DISTANCE) return;

    this.coins.delete(key);
    this.tweens.add({
      targets: coin,
      scale: COIN_SCALE * 2,
      alpha: 0,
      y: coin.y - 10,
      duration: 180,
      onComplete: () => coin.destroy(),
    });
    if (this.flow.barrierPassed()) void this.runQuestion();
  }

  // The extra-life heart sits in a far corner of the maze, once, mid-run.
  private maybeSpawnHeart(): void {
    if (this.heart || !this.flow.wantsHeart()) return;
    const hero = this.heroTarget();
    const far = openCells().filter((c) => manhattan(c, hero) >= 10);
    if (far.length === 0) return;
    const cell = far[Math.floor(Math.random() * far.length)];
    const at = center(cell);
    this.spawnHeartAt(at.x, at.y);
  }

  private caught(): boolean {
    const at = pixelOf(this.heroActor);
    return this.thieves.some((thief) => {
      if (!thief.active || this.playTime < thief.releaseAt) return false;
      const other = pixelOf(thief);
      return Phaser.Math.Distance.Between(at.x, at.y, other.x, other.y) < CATCH_DISTANCE;
    });
  }

  // ---- thieves on and off the board -----------------------------------------

  // Puts every active thief back on its starting cell (staggered release); the rest are hidden.
  private syncThieves(reset: boolean): void {
    const count = thiefCount(this.tuning.step * 5);
    for (const thief of this.thieves) {
      const shouldBeActive = thief.index < count;
      if (reset || (shouldBeActive && !thief.active)) {
        thief.cell = THIEF_STARTS[thief.index];
        thief.dir = null;
        thief.t = 0;
        thief.releaseAt = this.playTime + (reset ? thief.index : 0) * RELEASE_STAGGER_MS + 1200;
        const at = center(thief.cell);
        thief.sprite.setPosition(at.x, at.y);
      }
      thief.active = shouldBeActive;
      thief.sprite.setVisible(shouldBeActive);
    }
  }

  private resetPositions(): void {
    this.heroActor = { cell: HERO_START, dir: null, t: 0 };
    this.wantDir = null;
    this.facing = 'down';
    const at = center(HERO_START);
    this.hero.setPosition(at.x, at.y);
    this.hero.anims.stop();
    this.hero.setFrame(heroIdleFrame('front'));
    this.syncThieves(true);
  }

  // ---- collisions and questions (same rules as the other styles) -----------

  private async handleCollision(): Promise<void> {
    const outcome = this.flow.collide();
    this.cameras.main.shake(180, 0.01);
    if (outcome === 'life-lost') {
      this.resetPositions();
      this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
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
    this.resetPositions();
    await this.countdown();
    if (!this.alive) return;
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
    this.state = 'playing';
  }

  private async runQuestion(): Promise<void> {
    this.state = 'question';
    this.hero.anims.stop();
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
    this.syncThieves(false); // a new thief may join as the questions go by
    await this.countdown();
    if (!this.alive) return;
    this.wantDir = null; // the key that closed the question must not steer the hero
    this.invulnerableUntil = this.time.now + 1200;
    this.state = 'playing';
  }

  private handleShutdown(): void {
    this.alive = false;
    const keyboard = this.input.keyboard;
    for (const key of PHASER_KEYS) keyboard?.off(`keydown-${key}`, this.onDirectionKey, this);
    keyboard?.off('keydown-SPACE', this.onStartKey, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.coins.clear();
    this.thieves = [];
  }
}
