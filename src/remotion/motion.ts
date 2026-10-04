import { Easing, interpolate } from "remotion";

export { BEAT, BPM, FPS } from "./tempo";

// The whole video moves with these three curves instead of ad-hoc springs.
export const EASE = {
  // Fast start, long settle: entrances and camera pushes.
  out: Easing.bezier(0.16, 1, 0.3, 1),
  // Symmetric: cursor travel, drags and exits.
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  linear: Easing.linear,
};

export function tween(frame: number, start: number, end: number, from = 0, to = 1, easing = EASE.out) {
  if (end <= start) return frame < start ? from : to;
  return interpolate(frame, [start, end], [from, to], { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

// Rises to 1 at the midpoint of [start, end] and falls back to 0.
export function bump(frame: number, start: number, end: number) {
  const t = tween(frame, start, end, 0, 1, EASE.linear);
  return Math.sin(t * Math.PI);
}

export type Key<T extends string> = { at: number } & Record<T, number>;

// Piecewise keyframes: holds before the first and after the last key, eases between neighbours.
export function track<T extends string>(frame: number, keys: Key<T>[], fields: readonly T[], easing = EASE.inOut): Record<T, number> {
  const next = keys.findIndex((k) => k.at > frame);
  // Before the first key or after the last, a === b and the value holds.
  const b = next === -1 ? keys[keys.length - 1] : keys[next];
  const a = next > 0 ? keys[next - 1] : b;
  const out = {} as Record<T, number>;
  for (const f of fields) out[f] = tween(frame, a.at, b.at, (a as Record<T, number>)[f], (b as Record<T, number>)[f], easing);
  return out;
}

// Mixes a hex colour toward white so brand accents stay readable on the dark stage.
export function lighten(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `rgb(${r}, ${g}, ${b})`;
}
