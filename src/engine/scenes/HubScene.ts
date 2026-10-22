// The hall of games: the lobby of the bank where each room has its own door.
// The character walks left/right along the hall; up/Enter (or a click/tap on a
// door) walks into the room. The doors are drawn from the rooms the App passes
// in (one per content/rooms/<id>/room.json), and a barricaded corner marks the
// rooms that are still under construction. Plain shapes in the neutral
// palette; no question content here.
import Phaser from 'phaser';
import { COLORS, FONT_SANS, FONT_SERIF, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CREDITS } from '../credits';
import { Secrets } from '../secrets';
import { BankMenu } from '../ui/BankMenu';
import { hasKeyboard } from '../ui/input';
import { heroIdleFrame } from './BootScene';
import type { HeroView } from './BootScene';

export interface HubRoomView {
  id: string;
  title: string;
  tagline: string;
  accent: string; // "#RRGGBB"
  status: string; // line under the name, e.g. "45 questões" or "Missões em breve"
}

export interface HubSceneData {
  rooms: HubRoomView[];
  from?: string; // the room the player just left: the character steps out of its door
  onEnterRoom(roomId: string): void;
}

type Target =
  | { kind: 'room'; x: number; room: HubRoomView; glow?: Phaser.GameObjects.Rectangle }
  | { kind: 'build'; x: number };

const HERO_SCALE = 2.5;
const WALK_SPEED = 230; // px/s
const FLOOR_Y = 592; // feet line in the hall
const WALL_BOTTOM = 430;
const DOOR_W = 120;
const DOOR_H = 216;
const DOOR_TOP = WALL_BOTTOM - DOOR_H;
const NEAR = 64; // how close to a door the character must be to enter
const WHITE = '#ffffff';
const MUTED = '#9e9e9e';
const LIME = '#DBFFA5';
const BUILD_DOORS = [725, 845];
const BUILD_PLAQUE_X = 785;

export class HubScene extends Phaser.Scene {
  private params!: HubSceneData;
  private hero!: Phaser.GameObjects.Sprite;
  private facing: HeroView = 'right';
  private heroWalking = false;
  private left = false;
  private right = false;
  private locked = false;
  private targets: Target[] = [];
  private near: Target | null = null;
  private prompt!: Phaser.GameObjects.Text;
  private bankMenu!: BankMenu;
  private creditsClose: (() => void) | null = null;

  constructor() {
    super('HubScene');
  }

  init(data: HubSceneData): void {
    this.params = data;
    this.facing = 'right';
    this.heroWalking = false;
    this.left = false;
    this.right = false;
    this.locked = false;
    this.targets = [];
    this.near = null;
    this.creditsClose = null;
  }

  create(): void {
    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) throw new Error('HubScene: #ui-root element not found');
    this.bankMenu = new BankMenu(uiRoot, this.game.canvas);
    this.bankMenu.setSecrets(new Secrets().view());
    this.bankMenu.showChrome();

    this.buildHall();

    this.prompt = this.add
      .text(0, 0, '', {
        fontFamily: FONT_SANS,
        fontSize: '13px',
        fontStyle: '800',
        color: LIME,
        backgroundColor: '#1A1615',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setVisible(false);

    this.hero = this.add.sprite(0, 0, 'hero', heroIdleFrame('right')).setOrigin(0.5, 1).setDepth(10);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.events.once('shutdown', this.handleShutdown, this);

    const from = this.targets.find((t) => t.kind === 'room' && t.room.id === this.params.from);
    if (from) {
      this.stepOutOf(from);
    } else {
      this.placeHero(480, FLOOR_Y, 'right');
    }
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---- hero ---------------------------------------------------------------

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
    this.faceHero(view);
  }

  private walkTo(x: number, done: () => void): void {
    this.moveHero(x >= this.hero.x ? 'right' : 'left');
    this.tweens.add({
      targets: this.hero,
      x,
      duration: Math.max(60, (Math.abs(x - this.hero.x) / WALK_SPEED) * 1000),
      onComplete: () => {
        this.moveHero(null);
        done();
      },
    });
  }

  // Coming back from a room: the character steps out of its door into the hall.
  private stepOutOf(door: Target): void {
    this.locked = true;
    this.placeHero(door.x, WALL_BOTTOM + 40, 'front');
    this.hero.setScale(HERO_SCALE * 0.7).setAlpha(0);
    this.tweens.add({
      targets: this.hero,
      y: FLOOR_Y,
      scale: HERO_SCALE,
      alpha: 1,
      duration: 650,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.faceHero('right');
        this.locked = false;
      },
    });
  }

  // ---- scenery ------------------------------------------------------------

  private buildHall(): void {
    const g = this.add.graphics().setDepth(0);

    // Wall with wainscot, then the checkered floor (same language as the bank inside).
    g.fillStyle(COLORS.black).fillRect(0, 0, GAME_WIDTH, WALL_BOTTOM);
    g.fillStyle(COLORS.petrol).fillRect(0, 320, GAME_WIDTH, WALL_BOTTOM - 320);
    g.fillStyle(COLORS.forest).fillRect(0, 316, GAME_WIDTH, 6);
    for (let ty = WALL_BOTTOM; ty < GAME_HEIGHT; ty += 48) {
      for (let tx = 0; tx < GAME_WIDTH; tx += 48) {
        const light = ((tx / 48 + (ty - WALL_BOTTOM) / 48) | 0) % 2 === 0;
        g.fillStyle(light ? COLORS.paper : COLORS.grayNeutral).fillRect(tx, ty, 48, 48);
      }
    }
    g.fillStyle(COLORS.forest).fillRect(0, WALL_BOTTOM - 6, GAME_WIDTH, 12);

    // Ceiling lights.
    for (const lx of [150, 480, 810]) {
      g.fillStyle(COLORS.paper, 0.9).fillRect(lx - 36, 0, 72, 8);
      g.fillStyle(COLORS.paper, 0.06).fillTriangle(lx - 36, 8, lx + 36, 8, lx, 140);
    }

    this.addText(64, 36, 'QUEST HALL · SALÃO DE JOGOS', {
      fontFamily: FONT_SANS,
      fontSize: '12px',
      fontStyle: '800',
      color: MUTED,
    }).setLetterSpacing(2);
    this.addText(64, 54, 'Escolha sua sala', { fontFamily: FONT_SERIF, fontSize: '34px', color: WHITE });
    this.addText(48, 616, hasKeyboard() ? '← →  andar     ↑ ou Enter  entrar na sala     ou clique na porta' : 'Toque na porta da sala', {
      fontFamily: FONT_SANS,
      fontSize: '14px',
      fontStyle: '300',
      color: WHITE,
      backgroundColor: '#1A1615',
      padding: { x: 10, y: 5 },
    }).setOrigin(0, 0.5);

    // One door per room.
    const rooms = this.params.rooms;
    const first = 130;
    const last = 600;
    const gap = rooms.length > 1 ? Math.min(210, (last - first) / (rooms.length - 1)) : 0;
    rooms.forEach((room, index) => {
      const x = rooms.length === 1 ? 200 : first + index * gap;
      this.drawRoomDoor(g, x, room);
    });

    this.drawConstruction(g);

    // The whole door is clickable: the character walks there and goes in.
    for (const target of this.targets) {
      const zone = this.add.zone(target.x, DOOR_TOP + DOOR_H / 2, DOOR_W + 16, DOOR_H + 40).setInteractive().setDepth(30);
      zone.on('pointerdown', () => this.go(target));
    }
  }

  private addText(x: number, y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.add.text(x, y, value, style).setDepth(20);
  }

  private plaque(g: Phaser.GameObjects.Graphics, x: number, width: number, title: string, sub: string, edge: number): void {
    const top = DOOR_TOP - 76;
    g.fillStyle(COLORS.black).fillRect(x - width / 2, top, width, 52);
    g.lineStyle(2, edge).strokeRect(x - width / 2, top, width, 52);
    this.add
      .text(x, top + 16, title, {
        fontFamily: FONT_SANS,
        fontSize: '13px',
        fontStyle: '800',
        color: WHITE,
        align: 'center',
        wordWrap: { width: width - 16 },
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.add
      .text(x, top + 36, sub, { fontFamily: FONT_SANS, fontSize: '11px', fontStyle: '300', color: MUTED, align: 'center' })
      .setOrigin(0.5)
      .setDepth(20);
  }

  private drawRoomDoor(g: Phaser.GameObjects.Graphics, x: number, room: HubRoomView): void {
    const accent = Phaser.Display.Color.HexStringToColor(room.accent).color;
    const half = DOOR_W / 2;
    g.fillStyle(COLORS.grayNeutral).fillRect(x - half - 8, DOOR_TOP - 8, DOOR_W + 16, DOOR_H + 8);
    g.fillStyle(accent).fillRect(x - half - 8, DOOR_TOP - 14, DOOR_W + 16, 6);
    g.fillStyle(COLORS.black).fillRect(x - half, DOOR_TOP, DOOR_W, DOOR_H);
    g.fillStyle(COLORS.forest).fillRect(x - half + 6, DOOR_TOP + 6, half - 9, DOOR_H - 6);
    g.fillStyle(COLORS.forest).fillRect(x + 3, DOOR_TOP + 6, half - 9, DOOR_H - 6);
    g.fillStyle(COLORS.paper, 0.18).fillRect(x - half + 12, DOOR_TOP + 14, 8, DOOR_H - 22);
    g.fillStyle(accent).fillCircle(x - 9, DOOR_TOP + DOOR_H * 0.55, 3).fillCircle(x + 9, DOOR_TOP + DOOR_H * 0.55, 3);
    const glow = this.add.rectangle(x, DOOR_TOP + DOOR_H / 2, DOOR_W, DOOR_H, accent, 0.06).setDepth(1);
    this.plaque(g, x, 164, room.title, room.status, accent);
    this.targets.push({ kind: 'room', x, room, glow });
  }

  // Barricaded doors with hazard tape and cones: rooms that do not exist yet.
  private drawConstruction(g: Phaser.GameObjects.Graphics): void {
    const half = DOOR_W / 2;
    for (const x of BUILD_DOORS) {
      g.fillStyle(COLORS.grayDark).fillRect(x - half - 8, DOOR_TOP - 8, DOOR_W + 16, DOOR_H + 8);
      g.fillStyle(0x100d0c).fillRect(x - half, DOOR_TOP, DOOR_W, DOOR_H);
      g.fillStyle(COLORS.grayDark, 0.5).fillRect(x - half + 6, DOOR_TOP + 6, DOOR_W - 12, DOOR_H - 6);
      for (const y of [DOOR_TOP + 60, DOOR_TOP + 130]) {
        g.fillStyle(COLORS.black).fillRect(x - half - 12, y, DOOR_W + 24, 18);
        g.fillStyle(COLORS.lime);
        for (let sx = x - half - 12; sx < x + half + 4; sx += 16) {
          g.fillTriangle(sx, y + 18, sx + 8, y, sx + 16, y);
          g.fillTriangle(sx, y + 18, sx + 16, y, sx + 8, y + 18);
        }
      }
    }
    for (const cx of [BUILD_DOORS[0] - 82, BUILD_DOORS[1] + 82]) {
      g.fillStyle(COLORS.lime).fillTriangle(cx - 11, WALL_BOTTOM + 40, cx + 11, WALL_BOTTOM + 40, cx, WALL_BOTTOM + 8);
      g.fillStyle(COLORS.black).fillRect(cx - 14, WALL_BOTTOM + 40, 28, 5);
      g.fillStyle(COLORS.black).fillRect(cx - 6, WALL_BOTTOM + 24, 12, 4);
    }
    this.plaque(g, BUILD_PLAQUE_X, 190, 'Salas em construção', 'Novidades chegando', COLORS.lime);
    for (const x of BUILD_DOORS) this.targets.push({ kind: 'build', x });
  }

  // ---- doors --------------------------------------------------------------

  private go(target: Target): void {
    if (this.locked) return;
    this.locked = true;
    this.left = false;
    this.right = false;
    this.walkTo(target.x, () => this.activate(target));
  }

  private activate(target: Target): void {
    if (target.kind === 'build') {
      this.enterConstruction();
      return;
    }
    this.enterRoom(target);
  }

  private enterRoom(target: Extract<Target, { kind: 'room' }>): void {
    this.locked = true;
    this.prompt.setVisible(false);
    this.faceHero('back'); // walking away from us, into the door
    this.tweens.add({
      targets: this.hero,
      y: WALL_BOTTOM + 40,
      scale: HERO_SCALE * 0.7,
      alpha: 0,
      duration: 650,
      onComplete: () => {
        this.cameras.main.once('camerafadeoutcomplete', () => this.params.onEnterRoom(target.room.id));
        this.cameras.main.fadeOut(250, 0, 0, 0);
      },
    });
  }

  // Easter egg: behind the barricade is a thank-you screen for the first players.
  private enterConstruction(): void {
    this.prompt.setVisible(false);
    this.faceHero('back');
    this.tweens.add({
      targets: this.hero,
      y: WALL_BOTTOM + 40,
      scale: HERO_SCALE * 0.7,
      alpha: 0,
      duration: 650,
      onComplete: () => this.showCredits(),
    });
  }

  private showCredits(): void {
    const items: Phaser.GameObjects.GameObject[] = [];
    const cx = GAME_WIDTH / 2;
    const veil = this.add
      .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.black, 0.96)
      .setInteractive()
      .setDepth(100);
    items.push(veil);

    const text = (y: number, value: string, style: Phaser.Types.GameObjects.Text.TextStyle) => {
      const t = this.add.text(cx, y, value, { fontFamily: FONT_SANS, align: 'center', ...style }).setOrigin(0.5).setDepth(101).setAlpha(0);
      items.push(t);
      return t;
    };

    const lines = [
      text(70, 'OBRA SECRETA · CRÉDITOS', { fontSize: '12px', fontStyle: '800', color: LIME }),
      text(112, 'Elenco do salão', { fontFamily: FONT_SERIF, fontSize: '36px', color: WHITE }),
      text(160, 'Ninguém aqui existe de verdade, mas todo mundo já trabalhou com alguém assim.', {
        fontSize: '15px',
        fontStyle: '300',
        color: MUTED,
      }),
    ];
    lines[0].setLetterSpacing(2);

    const colX = [cx - 170, cx + 170];
    const perColumn = Math.ceil(CREDITS.length / 2);
    CREDITS.forEach((credit, i) => {
      const x = colX[Math.floor(i / perColumn)];
      const y = 232 + (i % perColumn) * 76;
      const name = text(0, credit.name, { fontSize: '19px', fontStyle: '800', color: WHITE });
      const role = text(0, credit.role, { fontSize: '13px', fontStyle: '300', color: MUTED });
      name.setPosition(x, y);
      role.setPosition(x, y + 24);
      lines.push(name, role);
    });

    lines.push(
      text(580, 'E obrigado a você, que achou esta sala', { fontSize: '13px', fontStyle: '800', color: LIME }),
      text(630, 'Esc, Enter ou clique para voltar ao salão', { fontSize: '12px', fontStyle: '300', color: MUTED }),
    );
    lines.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, delay: 150 + i * 90, duration: 400 }));

    this.creditsClose = () => {
      this.creditsClose = null;
      items.forEach((o) => o.destroy());
      this.hero.setPosition(this.hero.x, WALL_BOTTOM + 40).setScale(HERO_SCALE * 0.7).setAlpha(0);
      this.faceHero('front');
      this.tweens.add({
        targets: this.hero,
        y: FLOOR_Y,
        scale: HERO_SCALE,
        alpha: 1,
        duration: 650,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.faceHero('right');
          this.locked = false;
        },
      });
    };
    veil.once('pointerdown', () => this.creditsClose?.());
  }

  // ---- input --------------------------------------------------------------

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) event.preventDefault();
      return;
    }
    if (this.creditsClose) {
      if (['Escape', 'Enter', 'NumpadEnter', 'Space'].includes(event.code)) {
        event.preventDefault();
        this.creditsClose();
      }
      return;
    }
    if (this.locked) return;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.left = true;
    else if (event.code === 'ArrowRight' || event.code === 'KeyD') this.right = true;
    else if (['ArrowUp', 'KeyW', 'Enter', 'NumpadEnter', 'Space'].includes(event.code)) {
      if (!this.near) return;
      this.left = false;
      this.right = false;
      this.moveHero(null);
      this.locked = true;
      this.activate(this.near);
    } else return;
    event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') this.right = false;
  };

  update(): void {
    if (!this.hero) return;
    if (!this.locked) {
      const direction = (this.right ? 1 : 0) - (this.left ? 1 : 0);
      if (direction === 0) {
        this.moveHero(null);
      } else {
        const delta = this.game.loop.delta;
        this.hero.x = Phaser.Math.Clamp(this.hero.x + (direction * WALK_SPEED * delta) / 1000, 50, GAME_WIDTH - 50);
        this.moveHero(direction > 0 ? 'right' : 'left');
      }
    }
    this.refreshNear();
  }

  // The door the character stands in front of: lights up and offers to enter.
  private refreshNear(): void {
    const close = this.locked
      ? null
      : (this.targets.find((t) => Math.abs(t.x - this.hero.x) <= NEAR) ?? null);
    this.near = close;
    for (const target of this.targets) {
      if (target.kind === 'room') target.glow?.setAlpha(target === close ? 0.28 : 0.06);
    }
    if (!close) {
      this.prompt.setVisible(false);
      return;
    }
    const label = close.kind === 'room' ? `↑  Entrar: ${close.room.title}` : 'Sala em obras';
    this.prompt.setText(label).setPosition(this.hero.x, this.hero.y - this.hero.displayHeight - 6).setVisible(true);
  }

  private handleShutdown(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.bankMenu?.destroy();
    this.tweens.killAll();
  }
}
