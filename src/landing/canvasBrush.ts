// Lets drawStreet (written for Phaser Graphics) paint on a plain 2D canvas, so the
// landing page shows the very same street without loading the game engine.
import type { Brush } from '../engine/scenes/street';

function rgba(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;
}

export function canvasBrush(ctx: CanvasRenderingContext2D): Brush {
  let fill = 'rgba(0, 0, 0, 1)';
  let stroke = 'rgba(0, 0, 0, 1)';

  const brush: Brush = {
    fillStyle(color, alpha = 1) {
      fill = rgba(color, alpha);
      return brush;
    },
    fillRect(x, y, width, height) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, width, height);
      return brush;
    },
    fillTriangle(x1, y1, x2, y2, x3, y3) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
      return brush;
    },
    fillCircle(x, y, radius) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      return brush;
    },
    lineStyle(width, color, alpha = 1) {
      ctx.lineWidth = width;
      stroke = rgba(color, alpha);
      return brush;
    },
    strokeRect(x, y, width, height) {
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x, y, width, height);
      return brush;
    },
  };
  return brush;
}
