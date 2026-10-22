// The first screen is a small story: the character stands in front of the bank
// (the games hall) and can walk left/right (facing where they walk); pressing
// up/Enter (or clicking) walks into the door, on to the hall of rooms (HubScene).
// This scene is also the inside of one room: the missions are stacked in the
// middle (BankMenu) while the character waits on the left, facing the menu.
// Picking a mission and a question count plays a cutscene: the character walks
// right and kicks a coin, and that coin becomes the player in the run. Scenery
// is drawn with plain shapes in the neutral palette; no content strings here.
import Phaser from 'phaser';
import { pickCameo } from '../cast';
import type { Cameo } from '../cast';
import { COLORS, FONT_SANS, FONT_SERIF, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { scene } from '../palette';
import { ClickCounter, KONAMI, SequenceMatcher, BOSS_WORD } from '../easterEggs';
import { Secrets } from '../secrets';
import type { SecretId } from '../secrets';
import type { SizeOption } from '../modes';
import { GAME_STYLES } from '../styles';
import type { GameStyle } from '../styles';
import { BankMenu } from '../ui/BankMenu';
import type { HallView, HomeData, SizeData } from '../ui/BankMenu';
import { hasKeyboard } from '../ui/input';
import { heroIdleFrame } from './BootScene';
import { spawnCameo } from './cameoActor';
import { drawStreet, seededRandom, STREET_SEED } from './street';
import type { HeroView } from './BootScene';

export interface MenuSceneData {
  intro: boolean; // true = start in front of the bank (then on to the hall); false = already inside a room
  home?: HomeData; // the room being shown (not needed for the walk in front of the bank)
  cameo?: Cameo; // who drops by while the player is in the room
  onEnterBank?(): void; // the player walked through the door: on to the hall of rooms
  loadSizes(modeId: string): Promise<SizeData | null>;
  onStart(modeId: string, option: SizeOption, style: GameStyle): void;
  onRanking(): void;
  onProfile(): void;
  onBack(): void; // from the room back to the hall
}

type Phase = 'outside' | 'entering' | 'menu' | 'cutscene';

const HERO_SCALE = 2.5;
const WALK_SPEED = 190; // px/s with the arrow keys
const CUTSCENE_SPEED = 330; // px/s while walking to the coin
const DOOR_X = 640;
const STREET_Y = 538; // feet line in front of the bank
const FLOOR_Y = 592; // feet line inside
const HERO_INSIDE_X = 120;
const COIN_X = 800;
const COIN_Y = 572;
const WHITE = '#ffffff';
const MUTED = '#9e9e9e';

export class MenuScene extends Phaser.Scene {
  private params!: MenuSceneData;
  private phase: Phase = 'outside';
  private hero!: Phaser.GameObjects.Sprite;
  private facing: HeroView = 'right';
  private heroWalking = false;
  private heroBaseY = STREET_Y;
  private left = false;
  private right = false;
  private scenery: Phaser.GameObjects.GameObject[] = [];
  private coin: Phaser.GameObjects.Sprite | null = null;
  private bankMenu!: BankMenu;
  private cutsceneStartedAt = 0;
  private starting = false;
  private pendingStart: (() => void) | null = null;
  private konami!: SequenceMatcher;
  private bossWord!: SequenceMatcher;
  private signClicks = new ClickCounter(5, 3000);
  private coinClicks = new ClickCounter(5, 4000);
  private cameoActor: Phaser.GameObjects.Container | null = null;
  private readonly secrets = new Secrets();
  private secretsLabel: Phaser.GameObjects.Text | null = null;
  private jumpClicks = new ClickCounter(10, 10000);
  private jumping = false;
  private ambient: Phaser.Time.TimerEvent[] = [];
  private lampLight: Phaser.GameObjects.Arc | null = null;

  constructor() {
    super('MenuScene');
  }

  init(data: MenuSceneData): void {
    this.params = data;
    this.phase = 'outside';
    this.facing = 'right';
    this.heroWalking = false;
    this.left = false;
    this.right = false;
    this.scenery = [];
    this.coin = null;
    this.starting = false;
    this.pendingStart = null;
    this.cameoActor = null;
    this.signClicks = new ClickCounter(5, 3000);
    this.coinClicks = new ClickCounter(5, 4000);
    this.jumpClicks = new ClickCounter(10, 10000);
    this.jumping = false;
    this.ambient = [];
    this.lampLight = null;
    this.secretsLabel = null;
  }

  create(): void {
    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) throw new Error('MenuScene: #ui-root element not found');
    this.bankMenu = new BankMenu(uiRoot, this.game.canvas);
    this.bankMenu.setSecrets(this.secrets.view());

    this.hero = this.add.sprite(0, 0, 'hero', heroIdleFrame('right')).setOrigin(0.5, 1).setDepth(10);
    // Click the character to make them jump (ten jumps in a row is a secret).
    this.hero.setInteractive();
    this.hero.on('pointerdown', () => this.jump());

    this.konami = new SequenceMatcher(KONAMI, () => {
      this.discover('konami');
      this.konamiEgg();
    });
    this.bossWord = new SequenceMatcher(BOSS_WORD, () => {
      this.discover('chefe');
      this.showCameo(pickCameo('chefe'));
    });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.input.on('pointerdown', this.onPointer, this);
    this.events.once('shutdown', this.handleShutdown, this);

    if (this.params.intro) {
      this.buildOutside();
    } else {
      this.buildInside();
      this.cameras.main.fadeIn(250, 0, 0, 0);
    }
  }

  // ---- hero ---------------------------------------------------------------

  // view = walk that way (animated); null = stand still facing `this.facing`.
  private moveHero(view: HeroView | null): void {
    if (view) {
      this.facing = view;
      const key = `hero-walk-${view}`;
      if (!this.heroWalking || this.hero.anims.currentAnim?.key !== key) this.hero.play(key);
      this.heroWalking = true;
    } else if (this.heroWalking) {
      this.hero.anims.stop();
      this.heroWalking = false;
      this.hero.setFrame(heroIdleFrame(this.facing));
    }
  }

  private faceHero(view: HeroView): void {
    this.moveHero(null);
    this.facing = view;
    this.hero.setFrame(heroIdleFrame(view));
  }

  private placeHero(x: number, y: number, view: HeroView): void {
    this.hero.setPosition(x, y).setScale(HERO_SCALE).setAlpha(1).setVisible(true);
    this.heroBaseY = y;
    this.faceHero(view);
  }

  // ---- scenery helpers ----------------------------------------------------

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.scenery.push(object);
    return object;
  }

  // ---- hidden things: found secrets, toast, jump -----------------------------

  private discover(id: SecretId): void {
    const result = this.secrets.discover(id);
    this.refreshSecrets();
    if (!result.isNew) return;
    this.toast(result.all ? 'Todos os segredos! Você é de casa.' : `Segredo encontrado! ${result.found}/${result.total}`);
    if (result.all) this.konamiEgg();
  }

  private refreshSecrets(): void {
    const view = this.secrets.view();
    this.bankMenu.setSecrets(view);
    this.secretsLabel?.setText(`Segredos ${view.found}/${view.total}`);
  }

  private toast(value: string): void {
    const label = this.add
      .text(0, 0, value, { fontFamily: FONT_SANS, fontSize: '14px', fontStyle: '800', color: '#DBFFA5' })
      .setOrigin(0.5);
    const box = this.add.rectangle(0, 0, label.width + 28, 28, COLORS.black, 0.92).setStrokeStyle(2, COLORS.lime);
    const toast = this.add.container(GAME_WIDTH / 2, 18, [box, label]).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      hold: 1800,
      yoyo: true,
      onComplete: () => toast.destroy(),
    });
  }

  private floatLabel(value: string, x: number, y: number): void {
    const label = this.add
      .text(x, y, value, { fontFamily: FONT_SERIF, fontSize: '22px', color: scene().accentText })
      .setOrigin(0.5)
      .setDepth(55);
    this.tweens.add({ targets: label, y: y - 36, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }

  private jump(): void {
    if (this.jumping || (this.phase !== 'outside' && this.phase !== 'menu')) return;
    this.jumping = true;
    this.tweens.add({
      targets: this.hero,
      y: this.heroBaseY - 46,
      duration: 190,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.hero.y = this.heroBaseY;
        this.jumping = false;
      },
    });
    if (this.jumpClicks.click(this.time.now)) {
      this.discover('jump');
      this.floatLabel('Que pulo!', this.hero.x, this.hero.y - 130);
    }
  }

  private text(x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.track(this.add.text(x, y, value, style).setDepth(20));
  }

  // "quest" light + "hall" bold, centered on cx.
  private addWordmark(cx: number, y: number, size: number, depth: number): void {
    const base = { fontFamily: FONT_SANS, fontSize: `${size}px`, color: WHITE };
    const measure = (value: string, weight: string): number => {
      const probe = this.add.text(0, 0, value, { ...base, fontStyle: weight }).setVisible(false);
      const width = probe.width;
      probe.destroy();
      return width;
    };
    const questWidth = measure('quest', '300');
    const hallWidth = measure('hall', '800');
    const x = cx - (questWidth + hallWidth) / 2;
    this.track(this.add.text(x, y, 'quest', { ...base, fontStyle: '300' }).setOrigin(0, 0.5).setDepth(depth));
    this.track(
      this.add.text(x + questWidth, y, 'hall', { ...base, fontStyle: '800' }).setOrigin(0, 0.5).setDepth(depth),
    );
  }

  private titleBlock(): void {
    this.text(64, 44, 'QUEST HALL · TREINAMENTO', {
      fontFamily: FONT_SANS,
      fontSize: '12px',
      fontStyle: '800',
      color: scene().inkMuted,
    }).setLetterSpacing(2);
    this.text(64, 62, 'Salão de Jogos', {
      fontFamily: FONT_SERIF,
      fontSize: '38px',
      color: scene().ink,
    });
  }

  // ---- outside ------------------------------------------------------------

  private buildOutside(): void {
    this.phase = 'outside';
    const g = this.track(this.add.graphics().setDepth(0));

    // The whole street comes from drawStreet (fixed seed, palette of the theme), so the
    // landing page can show the very same picture.
    drawStreet(g, scene(), seededRandom(STREET_SEED));
    this.addWordmark(640, 234, 20, 2);

    this.titleBlock();
    const hint = this.text(64, 616, hasKeyboard() ? '← →  andar     ↑ ou Enter  entrar no salão     Espaço  pular' : '', {
      fontFamily: FONT_SANS,
      fontSize: '15px',
      fontStyle: '300',
      color: WHITE,
    });
    hint.setOrigin(0, 0.5);
    this.tweens.add({ targets: hint, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });

    // Easter egg: five quick clicks on the sign.
    const sign = this.track(this.add.zone(640, 234, 168, 40).setInteractive().setDepth(30));
    sign.on('pointerdown', () => {
      if (this.signClicks.click(this.time.now)) {
        this.discover('sign');
        this.signEgg();
      }
    });

    // The street lamp flickers when clicked.
    this.lampLight = this.track(this.add.circle(321, 326, 30, COLORS.paper, 0).setDepth(1));
    const lamp = this.track(this.add.zone(321, 415, 40, 190).setInteractive().setDepth(30));
    lamp.on('pointerdown', () => {
      this.discover('lamp');
      const light = this.lampLight;
      if (!light) return;
      this.tweens.killTweensOf(light);
      light.setAlpha(0);
      this.tweens.add({ targets: light, alpha: 0.85, duration: 70, yoyo: true, repeat: 5, onComplete: () => light.setAlpha(0) });
    });

    // A shooting star now and then, and a car passing by: both can be clicked.
    this.ambient.push(
      this.time.addEvent({ delay: 5000, callback: () => this.spawnShootingStar(), loop: true }),
      this.time.addEvent({ delay: 7000, callback: () => this.spawnCar(), loop: true }),
    );
    this.secretsLabel = this.text(GAME_WIDTH - 24, 616, '', {
      fontFamily: FONT_SANS,
      fontSize: '12px',
      fontStyle: '800',
      color: MUTED,
    });
    this.secretsLabel.setOrigin(1, 0.5).setLetterSpacing(1);
    this.refreshSecrets();

    this.placeHero(220, STREET_Y, 'right');
  }

  private spawnShootingStar(): void {
    if (this.phase !== 'outside') return;
    const x = Phaser.Math.Between(300, GAME_WIDTH - 40);
    const y = Phaser.Math.Between(20, 130);
    const star = this.track(this.add.rectangle(x, y, 8, 8, COLORS.paper).setDepth(3));
    star.setInteractive(new Phaser.Geom.Rectangle(-14, -14, 36, 36), Phaser.Geom.Rectangle.Contains);
    star.on('pointerdown', () => {
      this.discover('star');
      this.floatLabel('Faça um pedido!', star.x, star.y);
      this.tweens.killTweensOf(star);
      star.destroy();
    });
    this.tweens.add({
      targets: star,
      x: x - 280,
      y: y + 120,
      alpha: 0,
      duration: 1800,
      onComplete: () => star.destroy(),
    });
  }

  private spawnCar(): void {
    if (this.phase !== 'outside') return;
    const color = [COLORS.lime, COLORS.paper, COLORS.grayLight][Phaser.Math.Between(0, 2)];
    const car = this.track(this.add.container(-90, 604).setDepth(8));
    const body = this.add.rectangle(0, -4, 80, 22, color);
    car.add([
      this.add.rectangle(-4, -22, 44, 16, color),
      this.add.rectangle(-4, -22, 36, 10, COLORS.black, 0.75),
      body,
      this.add.rectangle(36, -4, 6, 6, COLORS.white),
      this.add.circle(-22, 10, 7, COLORS.black),
      this.add.circle(22, 10, 7, COLORS.black),
    ]);
    body.setInteractive(new Phaser.Geom.Rectangle(-10, -40, 100, 70), Phaser.Geom.Rectangle.Contains);
    body.on('pointerdown', () => {
      this.discover('car');
      this.floatLabel('Bi-bi!', car.x, car.y - 40);
      this.tweens.add({ targets: car, y: car.y - 14, duration: 110, yoyo: true });
    });
    this.tweens.add({ targets: car, x: GAME_WIDTH + 90, duration: 7000, onComplete: () => car.destroy() });
  }

  // ---- inside -------------------------------------------------------------

  private buildInside(): void {
    this.phase = 'menu';
    const g = this.track(this.add.graphics().setDepth(0));
    const P = scene();

    // Wall with wainscot, windows, vault door, floor, counter and plants.
    g.fillStyle(P.wall).fillRect(0, 0, GAME_WIDTH, 430);
    g.fillStyle(P.wainscot).fillRect(0, 300, GAME_WIDTH, 130);
    g.fillStyle(P.trim).fillRect(0, 296, GAME_WIDTH, 6);
    for (const wx of [86, 754]) {
      g.fillStyle(P.frame).fillRect(wx, 70, 120, 150);
      g.fillStyle(P.pane).fillRect(wx + 8, 78, 104, 134);
      g.fillStyle(P.frame, 0.18).fillRect(wx + 14, 84, 14, 120);
      g.fillStyle(P.frame).fillRect(wx + 56, 78, 8, 134);
    }
    g.fillStyle(COLORS.grayDark).fillCircle(850, 360, 74);
    g.fillStyle(COLORS.grayMid).fillCircle(850, 360, 64);
    g.fillStyle(COLORS.grayDark).fillCircle(850, 360, 26);
    g.fillStyle(COLORS.paper).fillCircle(850, 360, 12);
    g.fillStyle(COLORS.paper).fillRect(846, 300, 8, 24).fillRect(846, 396, 8, 24);

    for (let ty = 430; ty < GAME_HEIGHT; ty += 48) {
      for (let tx = 0; tx < GAME_WIDTH; tx += 48) {
        const light = ((tx / 48 + (ty - 430) / 48) | 0) % 2 === 0;
        g.fillStyle(light ? P.floorLight : P.floorDark).fillRect(tx, ty, 48, 48);
      }
    }
    g.fillStyle(P.trim).fillRect(0, 424, GAME_WIDTH, 12);
    g.fillStyle(P.trim).fillRect(700, 366, 250, 74);
    g.fillStyle(P.frame).fillRect(692, 356, 266, 14);
    g.fillStyle(P.frame, 0.14).fillRect(716, 296, 220, 60);
    for (const px of [40, 650]) {
      g.fillStyle(COLORS.grayDark).fillRect(px - 16, 392, 32, 36);
      g.fillStyle(COLORS.moss).fillCircle(px, 372, 24).fillCircle(px - 14, 386, 16).fillCircle(px + 14, 386, 16);
    }

    // The coin waiting on the floor (it becomes the player later).
    g.fillStyle(0x000000, 0.22).fillEllipse(COIN_X, COIN_Y + 24, 48, 12);
    const coin = this.track(this.add.sprite(COIN_X, COIN_Y, 'coin', 0).setScale(2).setDepth(6));
    coin.play({ key: 'coin-spin', frameRate: 4, repeat: -1 });
    this.coin = coin;
    // Easter egg: poke the coin five times.
    coin.setInteractive();
    coin.on('pointerdown', () => {
      if (!this.coinClicks.click(this.time.now)) return;
      this.discover('coin');
      this.tweens.add({ targets: coin, y: coin.y - 60, duration: 220, yoyo: true, ease: 'Sine.easeOut' });
      this.showCameo(pickCameo('coin'));
    });

    this.buildCat();
    this.refreshSecrets();
    this.placeHero(HERO_INSIDE_X, FLOOR_Y, 'right'); // facing the menu
    this.showModes();

    const cameo = this.params.cameo;
    if (cameo) this.time.delayedCall(700, () => this.phase === 'menu' && this.showCameo(cameo));
  }

  // The bank cat strolls along the bottom strip of the floor, the part of the
  // scene the menu cards leave visible. Click it for a "Miau".
  private buildCat(): void {
    const ink = COLORS.grayDark;
    const cat = this.track(this.add.container(300, 622).setDepth(7));
    const body = this.add.rectangle(0, -9, 30, 14, ink);
    cat.add([
      this.add.rectangle(-19, -16, 6, 18, ink), // tail
      body,
      this.add.rectangle(17, -17, 14, 12, ink), // head
      this.add.rectangle(13, -26, 4, 5, ink),
      this.add.rectangle(21, -26, 4, 5, ink), // ears
      this.add.rectangle(20, -17, 3, 3, COLORS.lime), // eye
      this.add.rectangle(-10, -1, 5, 4, ink),
      this.add.rectangle(10, -1, 5, 4, ink), // paws
    ]);
    body.setInteractive(new Phaser.Geom.Rectangle(-14, -22, 60, 42), Phaser.Geom.Rectangle.Contains);
    body.on('pointerdown', () => {
      this.discover('cat');
      this.floatLabel('Miau!', cat.x, cat.y - 40);
      this.tweens.add({ targets: cat, y: cat.y - 22, duration: 140, yoyo: true });
    });
    this.wanderCat(cat);
  }

  private wanderCat(cat: Phaser.GameObjects.Container): void {
    if (!cat.active || this.phase !== 'menu') return;
    const to = Phaser.Math.Between(270, 690);
    cat.setScale(to >= cat.x ? 1 : -1, 1);
    this.tweens.add({
      targets: cat,
      x: to,
      duration: Math.max(400, (Math.abs(to - cat.x) / 45) * 1000),
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(1500, 4000), () => this.wanderCat(cat)),
    });
  }

  // ---- cast and easter eggs ------------------------------------------------

  // One character at a time, standing at the right edge of the current place.
  private showCameo(cameo: Cameo): void {
    if (this.cameoActor?.active) return;
    const inside = this.phase !== 'outside';
    const actor = spawnCameo(this, cameo, {
      x: inside ? 880 : 910,
      y: inside ? FLOOR_Y + 8 : STREET_Y + 4,
      depth: 40,
      durationMs: 5200,
      onDone: () => {
        this.cameoActor = null;
      },
    });
    this.cameoActor = actor;
    this.track(actor);
  }

  // Konami code: a rain of lime squares and a word from the boss.
  private konamiEgg(): void {
    for (let i = 0; i < 48; i++) {
      const size = Phaser.Math.Between(6, 12);
      const piece = this.add
        .rectangle(Phaser.Math.Between(0, GAME_WIDTH), -20 - Phaser.Math.Between(0, 200), size, size, i % 3 === 0 ? COLORS.white : COLORS.lime)
        .setDepth(50);
      this.tweens.add({
        targets: piece,
        y: GAME_HEIGHT + 20,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(1400, 2600),
        delay: Phaser.Math.Between(0, 600),
        onComplete: () => piece.destroy(),
      });
    }
    this.showCameo(pickCameo('konami'));
  }

  // The sign briefly shows a sign-off.
  private signEgg(): void {
    const cover = this.add.rectangle(640, 234, 164, 36, COLORS.black).setDepth(31);
    const label = this.add
      .text(640, 234, 'Estude. Jogue. Repita.', { fontFamily: FONT_SERIF, fontSize: '18px', color: '#DBFFA5' })
      .setOrigin(0.5)
      .setDepth(32);
    this.time.delayedCall(2200, () => {
      cover.destroy();
      label.destroy();
    });
  }

  // ---- menu flow ----------------------------------------------------------

  /** The Hall da Fama list arrived after the menu opened. */
  updateHall(hall: HallView): void {
    if (this.params.home) this.params.home.hall = hall;
    this.bankMenu.setHall(hall);
  }

  private showModes(): void {
    const home = this.params.home;
    if (!home) return;
    this.bankMenu.showModes(home, {
      onPick: (modeId) => void this.pickMode(modeId),
      onRanking: () => this.params.onRanking(),
      onProfile: () => this.params.onProfile(),
      onBack: () => this.leaveRoom(),
    });
  }

  // Back to the hall: only from the mission list, never in the middle of a cutscene.
  private leaveRoom(): void {
    if (this.phase !== 'menu' || this.starting) return;
    this.starting = true;
    this.bankMenu.hide();
    this.cameras.main.once('camerafadeoutcomplete', () => this.params.onBack());
    this.cameras.main.fadeOut(250, 0, 0, 0);
  }

  // Mission picked: now how to play it (Desvie do obstáculo / Contra o tempo / Corrida).
  private async pickMode(modeId: string): Promise<void> {
    const sizes = await this.params.loadSizes(modeId);
    if (!sizes || this.phase !== 'menu') return;
    this.showStyles(modeId, sizes.modeTitle);
  }

  private showStyles(modeId: string, modeTitle: string): void {
    this.bankMenu.showStyles(
      {
        modeTitle,
        styles: GAME_STYLES.map(({ id, title, description }) => ({ id, title, description })),
      },
      {
        onPick: (styleId) => void this.pickStyle(modeId, styleId as GameStyle),
        onBack: () => this.showModes(),
      },
      this.params.home?.readiness,
    );
  }

  private async pickStyle(modeId: string, style: GameStyle): Promise<void> {
    const sizes = await this.params.loadSizes(modeId);
    if (!sizes || this.phase !== 'menu') return;
    this.bankMenu.showSizes(
      sizes,
      {
        onPick: (option) => this.playCutscene(modeId, option, style),
        onBack: () => this.showStyles(modeId, sizes.modeTitle),
      },
      this.params.home?.readiness,
    );
  }

  // ---- outside: walk and enter -------------------------------------------

  private enterBank(): void {
    if (this.phase !== 'outside') return;
    this.phase = 'entering';
    this.left = false;
    this.right = false;
    const toRight = DOOR_X >= this.hero.x;
    const distance = Math.abs(DOOR_X - this.hero.x);
    this.moveHero(toRight ? 'right' : 'left');
    this.tweens.add({
      targets: this.hero,
      x: DOOR_X,
      duration: Math.max(150, (distance / WALK_SPEED) * 1000),
      onComplete: () => {
        this.faceHero('back'); // walking away from us, into the door
        this.tweens.add({
          targets: this.hero,
          y: this.heroBaseY - 30,
          scale: HERO_SCALE * 0.75,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            this.cameras.main.once('camerafadeoutcomplete', () => this.params.onEnterBank?.());
            this.cameras.main.fadeOut(300, 0, 0, 0);
          },
        });
      },
    });
  }

  // ---- cutscene: walk, kick the coin, the coin becomes the player ---------

  private playCutscene(modeId: string, option: SizeOption, style: GameStyle): void {
    if (this.phase !== 'menu' || !this.coin) return;
    this.phase = 'cutscene';
    this.cutsceneStartedAt = this.time.now;
    this.bankMenu.hide();
    const coin = this.coin;
    const stopX = coin.x - 64;
    this.pendingStart = () => this.startRun(modeId, option, style);

    this.moveHero('right');
    this.tweens.add({
      targets: this.hero,
      x: stopX,
      duration: ((stopX - this.hero.x) / CUTSCENE_SPEED) * 1000,
      onComplete: () => {
        this.faceHero('right');
        // Kick: a quick lunge forward, the coin leaps to the right in an arc, spinning.
        this.hero.setFrame(heroIdleFrame('right') + 1);
        this.tweens.add({
          targets: this.hero,
          x: stopX + 22,
          duration: 110,
          yoyo: true,
          onComplete: () => this.faceHero('right'),
        });
        coin.anims.msPerFrame = 55;
        this.tweens.add({ targets: coin, x: GAME_WIDTH + 60, duration: 950, ease: 'Sine.easeOut' });
        this.tweens.add({
          targets: coin,
          y: coin.y - 280,
          duration: 450,
          ease: 'Sine.easeOut',
          yoyo: true,
          onComplete: () => this.showCoinBanner(),
        });
      },
    });
  }

  private showCoinBanner(): void {
    const group = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20).setDepth(30).setAlpha(0);
    group.add(
      this.add
        .text(0, -18, 'A moeda é você.', { fontFamily: FONT_SERIF, fontSize: '38px', color: WHITE })
        .setOrigin(0.5),
    );
    group.add(
      this.add
        .text(0, 26, 'Desvie dos obstáculos.', { fontFamily: FONT_SANS, fontSize: '18px', fontStyle: '300', color: WHITE })
        .setOrigin(0.5),
    );
    this.track(group);
    this.tweens.add({
      targets: group,
      alpha: 1,
      duration: 250,
      hold: 800,
      yoyo: true,
      onComplete: () => this.pendingStart?.(),
    });
  }

  private startRun(modeId: string, option: SizeOption, style: GameStyle): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.once('camerafadeoutcomplete', () => this.params.onStart(modeId, option, style));
    this.cameras.main.fadeOut(300, 0, 0, 0);
  }

  private skipCutscene(): void {
    if (this.phase !== 'cutscene' || this.time.now - this.cutsceneStartedAt < 300) return;
    this.tweens.killAll();
    this.pendingStart?.();
  }

  // ---- input --------------------------------------------------------------

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!event.repeat) {
      this.konami.feed(event.code);
      this.bossWord.feed(event.code);
    }
    if (event.repeat) {
      if (this.phase === 'outside' && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
        event.preventDefault();
      }
      return;
    }
    if (this.phase === 'outside') {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.left = true;
      else if (event.code === 'ArrowRight' || event.code === 'KeyD') this.right = true;
      else if (['ArrowUp', 'KeyW', 'Enter', 'NumpadEnter'].includes(event.code)) this.enterBank();
      else if (event.code === 'Space') this.jump();
      else return;
      event.preventDefault();
    } else if (this.phase === 'cutscene' && ['Enter', 'Space', 'Escape'].includes(event.code)) {
      this.skipCutscene();
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') this.right = false;
  };

  private onPointer(_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] = []): void {
    if (over.length > 0) return; // a click on the sign or the coin is an easter egg, not "enter"
    if (this.phase === 'outside') this.enterBank();
    else if (this.phase === 'cutscene') this.skipCutscene();
  }

  update(): void {
    if (!this.hero || this.phase !== 'outside') return;
    const direction = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    if (direction === 0) {
      this.moveHero(null);
      return;
    }
    const delta = this.game.loop.delta;
    this.hero.x = Phaser.Math.Clamp(this.hero.x + (direction * WALK_SPEED * delta) / 1000, 50, GAME_WIDTH - 50);
    this.moveHero(direction > 0 ? 'right' : 'left');
  }

  private handleShutdown(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.input.off('pointerdown', this.onPointer, this);
    this.bankMenu?.destroy();
    this.tweens.killAll();
  }
}
