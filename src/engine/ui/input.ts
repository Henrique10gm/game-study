// Whether the main pointing device is a finger (phone or tablet): keyboard hints are
// shown only when there is probably a keyboard. Laptops with a touch screen still
// report a fine primary pointer, so they keep the hints.
export function hasKeyboard(): boolean {
  try {
    return !window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}
