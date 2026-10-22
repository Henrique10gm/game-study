// A cast member appearing in a Phaser scene: slides in from the right edge,
// bobs while talking in a pixel speech bubble, then slides out and removes
// itself. Never interactive, so it never gets in the way of the game.
import Phaser from 'phaser';
import type { Cameo } from '../cast';
import { COLORS, FONT_SANS, GAME_WIDTH } from '../config';

export interface CameoOptions {
  x: number; // where the character stands (feet)
  y: number;
  depth: number;
  durationMs?: number; // time on screen once arrived
  onDone?: () => void;
}

const SCALE = 2.5;
const SPRITE_HEIGHT = 32 * SCALE;
const MAX_TEXT_WIDTH = 210;
const MUG_BLUE = 0x2f6fdb;

// A small blue mug held at hip height, drawn in the same chunky pixels as the sprite.
function drawMug(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const u = 4;
  const g = scene.add.graphics();
  const x = -23;
  const y = -26;
  g.fillStyle(COLORS.black).fillRect(x - 2, y - 2, u * 3 + 4, u * 3 + 4); // edge
  g.fillStyle(COLORS.black).fillRect(x + u * 3, y + u * 0.5, u + 2, u * 2); // handle edge
  g.fillStyle(MUG_BLUE).fillRect(x, y, u * 3, u * 3);
  g.fillStyle(MUG_BLUE).fillRect(x + u * 3, y + u * 0.5 + 2, u - 2, u * 2 - 4); // handle
  g.fillStyle(0x7fa8f0).fillRect(x + 2, y + 2, u, u * 2); // highlight
  return g;
}

export function spawnCameo(scene: Phaser.Scene, cameo: Cameo, options: CameoOptions): Phaser.GameObjects.Container {
  const { x, y, depth, durationMs = 4200, onDone } = options;

  const sprite = scene.add.sprite(0, 0, 'characters', cameo.who.frame).setOrigin(0.5, 1).setScale(SCALE);
  const figure = scene.add.container(0, 0, cameo.who.mug ? [sprite, drawMug(scene)] : [sprite]);

  const tag = scene.add
    .text(0, 0, `${cameo.who.name} · ${cameo.who.role}`.toUpperCase(), {
      fontFamily: FONT_SANS,
      fontSize: '10px',
      fontStyle: '800',
      color: '#666666',
    })
    .setLetterSpacing(1);
  const text = scene.add.text(0, 0, cameo.line, {
    fontFamily: FONT_SANS,
    fontSize: '14px',
    fontStyle: '600',
    color: '#1A1615',
    wordWrap: { width: MAX_TEXT_WIDTH },
    lineSpacing: 3,
  });

  const padding = 10;
  const width = Math.max(tag.width, text.width) + padding * 2;
  const height = tag.height + 4 + text.height + padding * 2 - 2;
  // Keep the bubble inside the screen whatever the character's x is.
  const left = Phaser.Math.Clamp(-width / 2, -x + 8, GAME_WIDTH - x - width - 8);
  const top = -SPRITE_HEIGHT - 14 - height;

  const bubble = scene.add.graphics();
  bubble.fillStyle(COLORS.forest).fillRect(left + 4, top + 4, width, height); // hard shadow
  bubble.fillStyle(COLORS.black).fillRect(left - 2, top - 2, width + 4, height + 4); // edge
  bubble.fillStyle(COLORS.paper).fillRect(left, top, width, height);
  bubble.fillStyle(COLORS.black).fillRect(-4, top + height + 2, 8, 6); // tail
  bubble.fillStyle(COLORS.paper).fillRect(-2, top + height, 4, 6);
  tag.setPosition(left + padding, top + padding - 1);
  text.setPosition(left + padding, top + padding + tag.height + 3);

  const container = scene.add.container(x + 260, y, [figure, bubble, tag, text]).setDepth(depth).setAlpha(0);
  // If the scene tears the actor down early, its tweens must stop with it.
  container.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf([container, figure]));

  scene.tweens.add({
    targets: container,
    x,
    alpha: 1,
    duration: 380,
    ease: 'Back.easeOut',
    onComplete: () => {
      // A little hop, like the character is talking.
      scene.tweens.add({ targets: figure, y: -6, duration: 160, yoyo: true, repeat: 2 });
      scene.tweens.add({
        targets: container,
        x: x + 260,
        alpha: 0,
        delay: durationMs,
        duration: 380,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (container.active) container.destroy();
          onDone?.();
        },
      });
    },
  });

  return container;
}
