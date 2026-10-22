// Segmented pixel progress bar (see pixel.css). `fraction` is 0..1; a bar that is
// not empty always shows at least one lit segment, and one that is not full never
// shows all of them, so "almost" and "done" look different. With `previous`, the
// segments gained since then are marked "gain" (shown in off-white).
import './pixel.css';

function litSegments(fraction: number, segments: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  let lit = Math.round(clamped * segments);
  if (clamped > 0 && lit === 0) lit = 1;
  if (clamped < 1 && lit === segments) lit = segments - 1;
  return lit;
}

export function pixelBar(fraction: number, segments = 20, className = '', previous?: number): HTMLElement {
  const bar = document.createElement('div');
  bar.className = `px-bar ${className}`.trim();
  const lit = litSegments(fraction, segments);
  const before = previous === undefined ? lit : Math.min(lit, litSegments(previous, segments));
  for (let i = 0; i < segments; i++) {
    const segment = document.createElement('span');
    if (i < before) segment.className = 'on';
    else if (i < lit) segment.className = 'gain';
    bar.appendChild(segment);
  }
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', String(Math.round(Math.min(1, Math.max(0, fraction || 0)) * 100)));
  return bar;
}
