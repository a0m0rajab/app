import type { CSSProperties } from "react";
import { EASE, tween } from "./motion";

type Props = {
  text: string;
  frame: number;
  // Frame the first unit starts rising from behind its mask.
  start: number;
  stagger?: number;
  duration?: number;
  // Frame the units start sliding up and out; omit to keep them on screen.
  exit?: number;
  // Reveal per character instead of per word.
  chars?: boolean;
  colorAt?: (index: number, count: number) => string | undefined;
  style?: CSSProperties;
};

// Text that rises into place from behind a clipping mask, one word (or character) at a time.
export function Masked({ text, frame, start, stagger = 2, duration = 16, exit, chars, colorAt, style }: Props) {
  const units = chars ? [...text] : text.split(/\s+/).filter(Boolean);
  return (
    <span style={style}>
      {units.map((unit, i) => {
        const enter = tween(frame, start + i * stagger, start + i * stagger + duration);
        const leave = exit === undefined ? 0 : tween(frame, exit + i * 0.6, exit + i * 0.6 + 8, 0, 1, EASE.inOut);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
              // Room for descenders inside the mask.
              paddingBottom: "0.14em",
              marginBottom: "-0.14em",
              marginRight: !chars && i < units.length - 1 ? "0.24em" : undefined,
            }}
          >
            <span
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                color: colorAt?.(i, units.length),
                transform: `translateY(${(1 - enter) * 110 - leave * 110}%)`,
              }}
            >
              {unit}
            </span>
          </span>
        );
      })}
    </span>
  );
}
