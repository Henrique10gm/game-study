// Preload scene: loads the character sheets, waits for the brand fonts, draws
// the pixel-art column/ground/coin textures procedurally (no external art for
// those), then hands off to the app (menu) via the "assets-ready" event.
// No content strings live here.
import Phaser from 'phaser';
import { COLORS } from '../config';
import charactersUrl from '../../assets/characters.png';
import heroUrl from '../../assets/hero.png';

// Hero views in hero.png: 3 poses each (idle + two steps), frame = view * 3 + pose.
export type HeroView = 'left' | 'right' | 'front' | 'back';
export const HERO_VIEWS: HeroView[] = ['left', 'right', 'front', 'back'];

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

// The sheets are loaded as plain images (not through Phaser's file loader), so
// the same code works with a normal URL and with the data URI the single-file
// Apps Script build inlines.
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('sprite sheet failed to load'));
    image.src = url;
  });
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.makeColumnTextures();
    this.makeGroundTexture();
    this.makeSkyline();
    this.makeHeart();
    this.makeRunnerIcons();
    this.makeClock();
    this.makeCoin();
    this.makeThief();

    // Phaser draws text once, so the brand fonts must be loaded first (a failure
    // just means the fallback font is used).
    const fonts = [
      "400 20px 'Merriweather Sans Variable'",
      "700 20px 'Merriweather Sans Variable'",
      "400 20px 'Merriweather Variable'",
    ];
    const fontsReady = Promise.all(fonts.map((font) => document.fonts.load(font))).catch(() => undefined);
    const sheetsReady = Promise.all([loadImage(charactersUrl), loadImage(heroUrl)]).then(
      ([characters, hero]) => {
        const frame = { frameWidth: 32, frameHeight: 32 };
        this.textures.addSpriteSheet('characters', characters, frame);
        this.textures.addSpriteSheet('hero', hero, frame);
        this.makeHeroAnimations();
      },
    );
    void Promise.all([fontsReady, sheetsReady]).then(() => this.game.events.emit('assets-ready'));
  }

  // The obstacles are the bank's stone columns: off-white shaft with a light
  // left edge and a shaded right edge, and a wider capital.
  private makeColumnTextures(): void {
    const body = this.add.graphics();
    body.fillStyle(COLORS.grayDark).fillRect(0, 0, 64, 32);
    body.fillStyle(COLORS.paper).fillRect(2, 0, 60, 32);
    body.fillStyle(COLORS.white).fillRect(6, 0, 8, 32);
    body.fillStyle(COLORS.grayNeutral).fillRect(46, 0, 14, 32);
    body.fillStyle(COLORS.grayMid).fillRect(24, 0, 2, 32).fillRect(36, 0, 2, 32);
    body.generateTexture('pipe', 64, 32);
    body.destroy();

    const cap = this.add.graphics();
    cap.fillStyle(COLORS.grayDark).fillRect(0, 0, 76, 28);
    cap.fillStyle(COLORS.paper).fillRect(2, 2, 72, 24);
    cap.fillStyle(COLORS.white).fillRect(6, 2, 10, 24);
    cap.fillStyle(COLORS.grayNeutral).fillRect(58, 2, 16, 24);
    cap.fillStyle(COLORS.grayMid).fillRect(2, 22, 72, 4);
    cap.generateTexture('pipe-cap', 76, 28);
    cap.destroy();
  }

  // Far-away city for the parallax: dark green blocks with a few lit windows.
  // 512 px wide and every building stays inside the tile, so it repeats cleanly.
  private makeSkyline(): void {
    const width = 512;
    const height = 220;
    const g = this.add.graphics();
    const buildings = [
      { x: 8, w: 56, h: 120 },
      { x: 76, w: 40, h: 170 },
      { x: 128, w: 64, h: 100 },
      { x: 204, w: 48, h: 190 },
      { x: 264, w: 60, h: 140 },
      { x: 336, w: 44, h: 110 },
      { x: 392, w: 52, h: 180 },
      { x: 456, w: 48, h: 130 },
    ];
    buildings.forEach((b, index) => {
      const top = height - b.h;
      g.fillStyle(index % 2 === 0 ? COLORS.forest : COLORS.petrol).fillRect(b.x, top, b.w, b.h);
      g.fillStyle(COLORS.black, 0.35).fillRect(b.x + b.w - 8, top, 8, b.h);
      for (let wy = top + 12; wy < height - 8; wy += 18) {
        for (let wx = b.x + 8; wx < b.x + b.w - 14; wx += 14) {
          const lit = (wx * 7 + wy * 13 + index * 5) % 5 === 0;
          if (lit) g.fillStyle(COLORS.lime, 0.55).fillRect(wx, wy, 6, 8);
        }
      }
    });
    g.generateTexture('skyline', width, height);
    g.destroy();
  }

  // Draws a pixel grid as a texture: each character is one cell, '.' is empty.
  private drawGrid(key: string, rows: string[], palette: Record<string, number>, cell = 4): void {
    const width = rows[0].length;
    if (rows.some((row) => row.length !== width)) throw new Error(`BootScene: ragged pixel grid "${key}"`);
    const g = this.add.graphics();
    rows.forEach((row, y) => {
      [...row].forEach((c, x) => {
        const color = palette[c];
        if (color !== undefined) g.fillStyle(color).fillRect(x * cell, y * cell, cell, cell);
      });
    });
    g.generateTexture(key, width * cell, rows.length * cell);
    g.destroy();
  }

  // Corrida: the obstacles the hero jumps over (low) or ducks under (high). Pixel
  // icons about compliance work, in the neutral palette only. Sizes match
  // runnerRules.ts (cells of 4 px).
  private makeRunnerIcons(): void {
    const palette = {
      K: COLORS.black,
      W: COLORS.white,
      P: COLORS.paper,
      L: COLORS.lime,
      F: COLORS.forest,
      G: COLORS.grayMid,
      N: COLORS.grayNeutral,
    };
    // stack of documents (40x44)
    this.drawGrid('obs-docs', [
      '..KKKKKKK.',
      '..KPPPPPK.',
      '..KPGGGPK.',
      '.KKPPPPPKK',
      '.KPPGGGPPK',
      '.KPPPPPPPK',
      'KKKKKKKKKK',
      'KPPPPPPPPK',
      'KPGGGGGGPK',
      'KPPPPPPPPK',
      'KKKKKKKKKK',
    ], palette);
    // archive box with a lime handle (44x36)
    this.drawGrid('obs-box', [
      'KKKKKKKKKKK',
      'KFFFFFFFFFK',
      'KFFFFFFFFFK',
      'KKKKKKKKKKK',
      'KFFFKKKFFFK',
      'KFFFKLKFFFK',
      'KFFFKKKFFFK',
      'KFFFFFFFFFK',
      'KKKKKKKKKKK',
    ], palette);
    // rubber stamp (36x36)
    this.drawGrid('obs-stamp', [
      '...KKK...',
      '..KPPPK..',
      '..KPPPK..',
      '...KPK...',
      'KKKKKKKKK',
      'KLLLLLLLK',
      'KLKKKKKLK',
      'KLLLLLLLK',
      'KKKKKKKKK',
    ], palette);
    // flying alarm light (44x28)
    this.drawGrid('obs-siren', [
      '...KKKKK...',
      '..KLLLLLK..',
      '.KLWLLLLLK.',
      'KKKKKKKKKKK',
      'PKFFFFFFFKP',
      'PPKKKKKKKPP',
      '.P.......P.',
    ], palette);
    // hanging sign with lime stripes (80x24)
    this.drawGrid('obs-banner', [
      '..K..............K..',
      '..K..............K..',
      'KKKKKKKKKKKKKKKKKKKK',
      'KLLKKLLKKLLKKLLKKLLK',
      'KLLKKLLKKLLKKLLKKLLK',
      'KKKKKKKKKKKKKKKKKKKK',
    ], palette);
    // audit drone (48x28)
    this.drawGrid('obs-drone', [
      'PPPP....PPPP',
      '..K..KK..K..',
      '..KKKKKKKK..',
      '.KFFFFFFFFK.',
      '.KFFLLLLFFK.',
      '..KFFFFFFK..',
      '...K....K...',
    ], palette);
  }

  // Contra o tempo: a pixel clock for the backdrop (48x48).
  private makeClock(): void {
    this.drawGrid(
      'clock',
      [
        '....KKKK....',
        '..KKPPPPKK..',
        '.KPPPPPPPPK.',
        '.KPPPPKPPPK.',
        'KPPPPPKPPPPK',
        'KPPPPPKPPPPK',
        'KPPPPPKKKPPK',
        'KPPPPPPPPPPK',
        '.KPPPPPPPPK.',
        '.KKPPPPPPKK.',
        '..KKKPPKKK..',
        '....KKKK....',
      ],
      { K: COLORS.black, P: COLORS.paper },
    );
  }

  // The extra-life pickup: a pixel heart, 9x8 cells of 4 px.
  private makeHeart(): void {
    const rows = ['.XX...XX.', 'XHXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
    const cell = 4;
    const g = this.add.graphics();
    // outline first (one cell around every filled cell), then the fill
    g.fillStyle(COLORS.moss);
    rows.forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c !== '.') g.fillRect(x * cell - 2, y * cell - 2, cell + 4, cell + 4);
      });
    });
    rows.forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c === 'X') g.fillStyle(COLORS.lime).fillRect(x * cell, y * cell, cell, cell);
        if (c === 'H') g.fillStyle(COLORS.white).fillRect(x * cell, y * cell, cell, cell);
      });
    });
    g.generateTexture('heart', 9 * cell, 8 * cell);
    g.destroy();
  }

  private makeGroundTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.petrol).fillRect(0, 0, 32, 32);
    g.fillStyle(COLORS.grayNeutral).fillRect(0, 0, 32, 8);
    g.fillStyle(COLORS.grayMid).fillRect(0, 8, 32, 3);
    g.fillStyle(COLORS.forest).fillRect(6, 16, 4, 4).fillRect(20, 22, 4, 4).fillRect(26, 14, 3, 3);
    g.generateTexture('ground', 32, 32);
    g.destroy();
  }

  // The coin (lime, the brand accent), 4 frames of a spin (24x24 each). It is
  // the player in the run and the coin the character kicks in the menu.
  private makeCoin(): void {
    const size = 24;
    const widths = [20, 14, 6, 14];
    const texture = this.textures.createCanvas('coin', size * widths.length, size);
    if (!texture) return;
    const ctx = texture.getContext();
    widths.forEach((width, i) => {
      const ox = i * size + (size - width) / 2;
      for (let y = 0; y < 22; y++) {
        const t = (y - 10.5) / 11;
        const half = Math.round((Math.sqrt(Math.max(0, 1 - t * t)) * width) / 2);
        if (half <= 0) continue;
        const cx = ox + width / 2;
        ctx.fillStyle = css(COLORS.moss);
        ctx.fillRect(cx - half, y + 1, half * 2, 1);
        if (half > 2) {
          ctx.fillStyle = css(COLORS.lime);
          ctx.fillRect(cx - half + 1, y + 1, half * 2 - 2, 1);
        }
        if (half > 4) {
          ctx.fillStyle = css(COLORS.white);
          ctx.fillRect(cx - half + 2, y + 1, 2, 1);
        }
      }
      if (width >= 14) {
        const cx = ox + width / 2;
        ctx.fillStyle = css(COLORS.moss);
        ctx.fillRect(cx - 1, 7, 2, 10);
        ctx.fillRect(cx - 3, 8, 6, 2);
        ctx.fillRect(cx - 3, 14, 6, 2);
      }
      texture.add(i, 0, i * size, 0, size, size);
    });
    texture.refresh();
    if (!this.anims.exists('coin-spin')) {
      this.anims.create({
        key: 'coin-spin',
        frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  // Fuja dos ladrões: the thief in a black-and-white striped shirt, grey beanie and eye
  // mask, in two walking frames (32x32, cells of 2 px).
  private makeThief(): void {
    const palette = {
      K: COLORS.black,
      W: COLORS.white,
      P: COLORS.paper,
      D: COLORS.grayDark,
      G: COLORS.grayMid,
      L: COLORS.lime,
    };
    const upper = [
      '.......LL.......',
      '.....GGGGGG.....',
      '....GGGGGGGG....',
      '....PPPPPPPP....',
      '....KKKKKKKK....',
      '....KWKKKKWK....',
      '....PPPPPPPP....',
      '..KKKKKKKKKKKK..',
      '..KWWWWWWWWWWK..',
      '..KKKKKKKKKKKK..',
      '..KWWWWWWWWWWK..',
      '..PKKKKKKKKKKP..',
      '....DDDDDDDD....',
    ];
    this.drawGrid('thief-a', [...upper, '....DDD..DDD....', '....DDD..DDD....', '....KKK..KKK....'], palette, 2);
    this.drawGrid('thief-b', [...upper, '.....DDDDDD.....', '.....DDDDDD.....', '.....KKKKKK.....'], palette, 2);
  }

  // hero-walk-<view>: step, idle, other step, idle.
  private makeHeroAnimations(): void {
    HERO_VIEWS.forEach((view, index) => {
      const key = `hero-walk-${view}`;
      if (this.anims.exists(key)) return;
      const base = index * 3;
      this.anims.create({
        key,
        frames: [base + 1, base, base + 2, base].map((frame) => ({ key: 'hero', frame })),
        frameRate: 9,
        repeat: -1,
      });
    });
  }
}

/** Frame index of a hero view's idle pose. */
export function heroIdleFrame(view: HeroView): number {
  return HERO_VIEWS.indexOf(view) * 3;
}
