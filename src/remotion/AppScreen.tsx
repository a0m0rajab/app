import type { CSSProperties } from "react";
import { interpolate } from "remotion";
import { EASE, bump, tween } from "./motion";
import type { Screen } from "./types";

// The mock app is laid out on a fixed canvas so the camera and cursor can target exact points.
export const APP_W = 1440;
export const APP_H = 900;
const SIDEBAR = 240;
const X0 = SIDEBAR + 40;
const X1 = APP_W - 40;
const MAIN_W = X1 - X0;
const CONTENT_Y = 232;
const CONTENT_H = APP_H - 40 - CONTENT_Y;

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const DONE = /done|complete|paid|live|shipped|closed/i;
const RISK = /risk|block|late|fail|overdue/i;

export type Point = { x: number; y: number };

// Progress of the scripted interaction on a screen, each 0 to 1.
export type Interaction = { focus: number; flip: number; lift: number; travel: number };
export const IDLE: Interaction = { focus: 0, flip: 0, lift: 0, travel: 0 };

export type ScreenAction = {
  kind: "hover" | "click" | "drag";
  // Where the cursor acts, and for a drag where it lets go.
  from: Point;
  to?: Point;
  // What the camera frames while the action plays out.
  focus: Point;
  zoom: number;
};

const abs = (left: number, top: number, width: number, height: number): CSSProperties => ({ position: "absolute", left, top, width, height });

const appear = (age: number, delay: number) => tween(age, delay, delay + 16);

export const navPoint = (i: number): Point => ({ x: 84, y: 100 + i * 52 + 22 });

export function AppSidebar({ navItems, productName, brandColor, active }: { navItems: string[]; productName: string; brandColor: string; active: number }) {
  return (
    <div style={{ ...abs(0, 0, SIDEBAR, APP_H), background: "#f8fafc", borderRight: `1px solid ${LINE}` }}>
      <div style={{ ...abs(24, 34, 200, 32), display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: brandColor, color: "#fff", fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {productName.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{productName}</span>
      </div>
      {navItems.map((item, i) => (
        <div
          key={i}
          style={{
            ...abs(16, 100 + i * 52, SIDEBAR - 32, 44),
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            borderRadius: 10,
            fontSize: 17,
            fontWeight: i === active ? 600 : 500,
            color: i === active ? brandColor : MUTED,
            background: i === active ? `${brandColor}17` : "transparent",
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

// Everything right of the sidebar. `age` is frames since the screen was opened.
export function AppMain({ screen, brandColor, age, act }: { screen: Screen; brandColor: string; age: number; act: Interaction }) {
  const metricW = (MAIN_W - 40) / 3;
  return (
    <div style={abs(0, 0, APP_W, APP_H)}>
      <div style={{ ...abs(X0, 36, 700, 44), fontSize: 30, fontWeight: 700, color: INK, letterSpacing: "-0.02em", opacity: appear(age, 0) }}>{screen.title}</div>
      <div style={{ ...abs(X1 - 330, 38, 270, 40), borderRadius: 10, background: "#f1f5f9", color: "#94a3b8", fontSize: 15, display: "flex", alignItems: "center", padding: "0 16px" }}>
        Search…
      </div>
      <div style={{ ...abs(X1 - 40, 38, 40, 40), borderRadius: 20, background: `linear-gradient(135deg, ${brandColor}55, ${brandColor}22)` }} />

      {screen.metrics.map((m, i) => {
        const p = appear(age, 4 + i * 3);
        return (
          <div
            key={i}
            style={{
              ...abs(X0 + i * (metricW + 20), 104, metricW, 104),
              borderRadius: 14,
              border: `1px solid ${LINE}`,
              padding: "20px 22px",
              opacity: p,
              transform: `translateY(${(1 - p) * 14}px)`,
            }}
          >
            <div style={{ fontSize: 15, color: MUTED }}>{m.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: INK, marginTop: 6, letterSpacing: "-0.02em" }}>{countUp(m.value, tween(age, 6 + i * 3, 36 + i * 3))}</div>
          </div>
        );
      })}

      {screen.kind === "chart" && <Chart values={screen.chart} brandColor={brandColor} age={age} act={act} />}
      {screen.kind === "table" && <Table rows={screen.rows} brandColor={brandColor} age={age} act={act} />}
      {screen.kind === "board" && <Board rows={screen.rows} brandColor={brandColor} age={age} act={act} />}
    </div>
  );
}

// Where the cursor and camera go to show each screen off.
export function screenAction(screen: Screen): ScreenAction {
  if (screen.kind === "chart") {
    const g = chartGeometry(screen.chart);
    const bar = g.bars[g.peak];
    return { kind: "hover", from: { x: bar.x + g.barW / 2, y: bar.top + 26 }, focus: { x: bar.x + g.barW / 2, y: (bar.top + g.bottom) / 2 - 40 }, zoom: 1.55 };
  }
  if (screen.kind === "table") {
    const row = tableTarget(screen.rows);
    const y = rowTop(row) + ROW_H / 2;
    return { kind: "click", from: { x: X1 - 92, y }, focus: { x: X0 + MAIN_W / 2, y }, zoom: 1.3 };
  }
  const g = boardGeometry(screen.rows);
  if (!g.drag) return { kind: "hover", from: g.slot(0, 0), focus: g.slot(0, 0), zoom: 1.4 };
  const grip = (p: Point) => ({ x: p.x - 70, y: p.y + 4 });
  return { kind: "drag", from: grip(g.drag.from), to: grip(g.drag.to), focus: { x: X0 + MAIN_W / 2, y: CONTENT_Y + 190 }, zoom: 1.28 };
}

const WEEKS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7"];

function chartGeometry(values: number[]) {
  const count = Math.max(values.length, 1);
  const left = X0 + 36;
  const right = X1 - 36;
  const top = CONTENT_Y + 96;
  const bottom = CONTENT_Y + CONTENT_H - 52;
  const gap = 28;
  const barW = (right - left - gap * (count - 1)) / count;
  const max = Math.max(...values, 1);
  const bars = values.map((v, i) => ({ x: left + i * (barW + gap), top: bottom - (v / max) * (bottom - top) * 0.9 }));
  const peak = values.lastIndexOf(Math.max(...values));
  return { bars, barW, top, bottom, peak: Math.max(peak, 0) };
}

function Chart({ values, brandColor, age, act }: { values: number[]; brandColor: string; age: number; act: Interaction }) {
  const g = chartGeometry(values);
  const peak = g.bars[g.peak];
  const prev = values[g.peak - 1];
  const change = prev ? Math.round(((values[g.peak] - prev) / prev) * 100) : 0;
  return (
    <>
      <div style={{ ...abs(X0, CONTENT_Y, MAIN_W, CONTENT_H), borderRadius: 14, border: `1px solid ${LINE}`, opacity: appear(age, 8) }} />
      <div style={{ ...abs(X0 + 36, CONTENT_Y + 28, 400, 24), fontSize: 16, fontWeight: 600, color: MUTED }}>Last 7 weeks</div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ ...abs(X0 + 36, g.top + ((g.bottom - g.top) / 3) * i, MAIN_W - 72, 1), background: "#f1f5f9" }} />
      ))}
      {g.bars.map((bar, i) => {
        const grow = tween(age, 12 + i * 2.5, 34 + i * 2.5);
        const dim = i === g.peak ? 1 : 1 - act.focus * 0.6;
        return (
          <div key={i}>
            <div
              style={{
                ...abs(bar.x, g.bottom - (g.bottom - bar.top) * grow, g.barW, (g.bottom - bar.top) * grow),
                borderRadius: "10px 10px 3px 3px",
                background: `linear-gradient(180deg, ${brandColor}, ${brandColor}b3)`,
                opacity: dim,
              }}
            />
            <div style={{ ...abs(bar.x, g.bottom + 16, g.barW, 20), textAlign: "center", fontSize: 14, color: "#94a3b8" }}>{WEEKS[i]}</div>
          </div>
        );
      })}
      {values.length > 0 && (
        <div
          style={{
            ...abs(peak.x + g.barW / 2 - 85, peak.top - 92, 170, 72),
            borderRadius: 12,
            background: INK,
            color: "#fff",
            padding: "12px 16px",
            boxShadow: "0 12px 30px rgba(15,23,42,0.25)",
            opacity: act.focus,
            transform: `translateY(${(1 - act.focus) * 10}px) scale(${0.94 + act.focus * 0.06})`,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(values[g.peak])}</div>
          <div style={{ fontSize: 13, color: change >= 0 ? "#4ade80" : "#f87171", fontWeight: 600, marginTop: 2 }}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last week
          </div>
        </div>
      )}
    </>
  );
}

function pillColor(status: string, brandColor: string) {
  return RISK.test(status) ? "#dc2626" : DONE.test(status) ? "#16a34a" : brandColor;
}

function StatusPill({ status, brandColor, scale = 1 }: { status: string; brandColor: string; scale?: number }) {
  const color = pillColor(status, brandColor);
  return (
    <span style={{ display: "inline-block", fontSize: 14, fontWeight: 600, color, background: `${color}1a`, padding: "6px 14px", borderRadius: 999, transform: `scale(${scale})` }}>
      {status}
    </span>
  );
}

type Row = Screen["rows"][number];

const HEAD_H = 52;
const ROW_H = 76;
const rowTop = (i: number) => CONTENT_Y + HEAD_H + i * ROW_H;
const tableTarget = (rows: Row[]) => Math.max(0, rows.findIndex((r) => !DONE.test(r.status)));

function Table({ rows, brandColor, age, act }: { rows: Row[]; brandColor: string; age: number; act: Interaction }) {
  const target = tableTarget(rows);
  const cell: CSSProperties = { position: "absolute", top: 0, height: "100%", display: "flex", alignItems: "center" };
  return (
    <>
      <div style={{ ...abs(X0, CONTENT_Y, MAIN_W, HEAD_H + rows.length * ROW_H), borderRadius: 14, border: `1px solid ${LINE}`, opacity: appear(age, 8) }} />
      <div style={{ ...abs(X0, CONTENT_Y, MAIN_W, HEAD_H), fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", color: "#94a3b8", opacity: appear(age, 8) }}>
        <span style={{ ...cell, left: 28 }}>NAME</span>
        <span style={{ ...cell, left: MAIN_W - 420 }}>DETAIL</span>
        <span style={{ ...cell, left: MAIN_W - 170 }}>STATUS</span>
      </div>
      {rows.map((row, i) => {
        const p = appear(age, 12 + i * 3);
        const hit = i === target;
        const status = hit && act.flip >= 0.5 ? "Done" : row.status;
        return (
          <div
            key={i}
            style={{
              ...abs(X0, rowTop(i), MAIN_W, ROW_H),
              borderTop: `1px solid ${LINE}`,
              background: hit ? `${brandColor}${Math.round(bump(act.flip, 0, 1) * 18 + act.flip * 8).toString(16).padStart(2, "0")}` : "transparent",
              opacity: p,
              transform: `translateY(${(1 - p) * 16}px)`,
            }}
          >
            <span style={{ ...cell, left: 28, fontSize: 18, fontWeight: 600, color: INK }}>{row.title}</span>
            <span style={{ ...cell, left: MAIN_W - 420, fontSize: 16, color: MUTED }}>{row.meta}</span>
            <span style={{ ...cell, left: MAIN_W - 170 }}>
              <StatusPill status={status} brandColor={brandColor} scale={hit ? 1 + bump(act.flip, 0.4, 1) * 0.14 : 1} />
            </span>
          </div>
        );
      })}
      <div
        style={{
          ...abs(X1 - 300, CONTENT_Y + HEAD_H + rows.length * ROW_H + 28, 300, 48),
          borderRadius: 12,
          background: INK,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 18px",
          opacity: tween(act.flip, 0.5, 1),
          transform: `translateY(${(1 - tween(act.flip, 0.5, 1)) * 14}px)`,
        }}
      >
        <span style={{ color: "#4ade80" }}>✓</span> Status updated
      </div>
    </>
  );
}

const COL_GAP = 20;
const COL_W = (MAIN_W - COL_GAP * 2) / 3;
const CARD_H = 92;
const CARD_STEP = CARD_H + 12;
const CARDS_Y = CONTENT_Y + 64;

function boardGeometry(rows: Row[]) {
  const columns = [...new Set(rows.map((r) => r.status))].slice(0, 3);
  const slot = (c: number, k: number): Point => ({ x: X0 + c * (COL_W + COL_GAP) + COL_W / 2, y: CARDS_Y + k * CARD_STEP + CARD_H / 2 });
  const placed = rows
    .map((row, i) => ({ row, i, col: columns.indexOf(row.status) }))
    .filter((p) => p.col !== -1)
    .map((p, _, all) => ({ ...p, k: all.filter((q) => q.col === p.col && q.i < p.i).length }));
  const moving = placed.find((p) => p.col === 0);
  const dest = columns.length - 1;
  const drag =
    moving && dest > 0 ? { card: moving.i, dest, from: slot(0, moving.k), to: slot(dest, placed.filter((p) => p.col === dest).length) } : undefined;
  return { columns, placed, slot, drag };
}

function Board({ rows, brandColor, age, act }: { rows: Row[]; brandColor: string; age: number; act: Interaction }) {
  const { columns, placed, slot, drag } = boardGeometry(rows);
  const moved = drag && act.travel > 0.5;
  const reflow = interpolate(act.travel, [0.2, 0.6], [0, 1], { easing: EASE.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const movingK = drag ? placed.find((p) => p.i === drag.card)!.k : -1;

  return (
    <>
      {columns.map((column, c) => {
        const count = placed.filter((p) => p.col === c).length + (moved ? (c === 0 ? -1 : c === drag.dest ? 1 : 0) : 0);
        return (
          <div key={column} style={{ ...abs(X0 + c * (COL_W + COL_GAP), CONTENT_Y, COL_W, CONTENT_H), borderRadius: 14, background: "#f1f5f9", opacity: appear(age, 6 + c * 2) }}>
            <div style={{ position: "absolute", left: 18, top: 18, display: "flex", gap: 10, alignItems: "center", fontSize: 16, fontWeight: 600, color: "#475569" }}>
              {column}
              <span style={{ fontSize: 13, color: MUTED, background: "#e2e8f0", borderRadius: 999, padding: "2px 9px" }}>{count}</span>
            </div>
          </div>
        );
      })}
      {placed.map(({ row, i, col, k }) => {
        const p = appear(age, 12 + col * 3 + k * 3);
        const dragging = drag?.card === i;
        let { x, y } = slot(col, k);
        if (dragging) {
          x = interpolate(act.travel, [0, 1], [drag.from.x, drag.to.x]);
          y = interpolate(act.travel, [0, 1], [drag.from.y, drag.to.y]);
        } else if (drag && col === 0 && k > movingK) {
          y -= CARD_STEP * reflow;
        }
        const lift = dragging ? act.lift : 0;
        return (
          <div
            key={i}
            style={{
              ...abs(x - COL_W / 2 + 14, y - CARD_H / 2, COL_W - 28, CARD_H),
              borderRadius: 12,
              background: "#ffffff",
              padding: "16px 18px",
              zIndex: dragging ? 2 : 1,
              boxShadow: `0 ${1 + lift * 22}px ${3 + lift * 40}px rgba(15,23,42,${0.1 + lift * 0.12})`,
              opacity: p,
              transform: `translateY(${(1 - p) * 18}px) rotate(${lift * 2.5}deg) scale(${1 + lift * 0.04})`,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.title}</div>
            <div style={{ marginTop: 10, fontSize: 14, color: brandColor, fontWeight: 600 }}>{row.meta}</div>
          </div>
        );
      })}
    </>
  );
}

// Count up the numeric part of a value like "5,000+" or "99.9%".
export function countUp(value: string, progress: number) {
  const match = value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  if (!match) return value;
  const [, prefix, num, suffix] = match;
  const target = Number(num.replace(/,/g, ""));
  if (!Number.isFinite(target)) return value;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  const current = interpolate(progress, [0, 1], [0, target]);
  const formatted = current.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: num.includes(","),
  });
  return `${prefix}${formatted}${suffix}`;
}
