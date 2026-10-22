// Small pixel-art face for the DOM screens (question speaker, end-of-run cameo):
// a div showing one frame of the characters sheet, scaled with hard edges.
import charactersUrl from '../../assets/characters.png';

const FRAME = 32;
const FRAMES = 8;

export function characterAvatar(frame: number, scale = 2, mug = false): HTMLElement {
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  const size = FRAME * scale;
  avatar.style.width = `${size}px`;
  avatar.style.height = `${size}px`;
  avatar.style.flex = 'none';
  avatar.style.backgroundImage = `url(${charactersUrl})`;
  avatar.style.backgroundRepeat = 'no-repeat';
  avatar.style.backgroundSize = `${size * FRAMES}px ${size}px`;
  avatar.style.backgroundPosition = `-${frame * size}px 0`;
  avatar.style.imageRendering = 'pixelated';
  if (mug) {
    // Blue mug in the hand, placed in proportion to the frame (same spot as in the scenes).
    const cup = document.createElement('span');
    Object.assign(cup.style, {
      position: 'absolute',
      left: `${size * 0.2125}px`,
      top: `${size * 0.675}px`,
      width: `${size * 0.15}px`,
      height: `${size * 0.15}px`,
      background: '#2f6fdb',
      boxShadow: `0 0 0 ${scale}px #1a1615, ${size * 0.075}px ${size * 0.0125}px 0 ${scale / 2}px #2f6fdb`,
    });
    avatar.style.position = 'relative';
    avatar.appendChild(cup);
  }
  return avatar;
}
