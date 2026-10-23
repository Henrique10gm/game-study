// The walk to the bank door is driven by how far the visitor has scrolled through the
// last section of the landing page. Pure functions: the page only feeds them numbers.
import { STREET } from '../engine/scenes/street';

export const WALK_START = 0.1; // before this the hero waits on the left
export const WALK_END = 0.82; // after this the hero stands at the door
export const AT_DOOR = 0.9; // from here on the "Entrar" prompt shows
export const HERO_START_X = 90;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 when the section has just reached the top of the screen, 1 when its end does. */
export function sectionProgress(scrollY: number, sectionTop: number, sectionHeight: number, viewportHeight: number): number {
  const travel = sectionHeight - viewportHeight;
  if (travel <= 0) return 1;
  return clamp01((scrollY - sectionTop) / travel);
}

/** Where the hero stands, in street pixels (the street is 960 wide). */
export function heroX(progress: number): number {
  const walk = clamp01((progress - WALK_START) / (WALK_END - WALK_START));
  return HERO_START_X + (STREET.doorX - HERO_START_X) * walk;
}

export function atDoor(progress: number): boolean {
  return progress >= AT_DOOR;
}

/**
 * Horizontal camera shift (px) for a stage wider than the screen: keeps the hero near the
 * middle without showing past the edges. 0 when the whole stage fits.
 */
export function cameraShift(heroPx: number, stageWidth: number, viewportWidth: number): number {
  if (stageWidth <= viewportWidth) return 0;
  const limit = (stageWidth - viewportWidth) / 2;
  return Math.min(limit, Math.max(-limit, stageWidth / 2 - heroPx));
}
