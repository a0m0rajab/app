import { useMemo } from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { APP_H, APP_W, AppMain, AppSidebar, IDLE, navPoint, screenAction, type Interaction, type Point, type ScreenAction } from "./AppScreen";
import { Masked } from "./Kinetic";
import { EASE, bump, lighten, track, tween, type Key } from "./motion";
import type { Storyboard } from "./types";

const CHROME = 44;
const REST: Point = { x: APP_W * 0.64, y: APP_H * 0.78 };
const WIDE = { x: APP_W / 2, y: APP_H / 2, z: 1 };
const SWAP = 8;

type Span = { from: number; duration: number };

// One feature's beats inside the take, in frames from the start of the take.
type Plan = {
  start: number;
  end: number;
  // When this feature's screen replaces the previous one.
  swap: number;
  navClick?: number;
  nav: number;
  pushStart: number;
  pushEnd: number;
  actStart: number;
  actEnd: number;
  pullStart: number;
  dragStart: number;
  dragEnd: number;
  clickAt: number;
  // Null when the feature shows an uploaded screenshot instead of the mock app.
  action: ScreenAction | null;
};

function buildPlans(storyboard: Storyboard, spans: Span[]): Plan[] {
  const navCount = Math.max(storyboard.navItems.length, 1);
  return spans.map(({ from, duration }, i) => {
    const at = (p: number) => from + Math.round(p * duration);
    const feature = storyboard.features[i];
    const action = feature.screenshot ? null : screenAction(feature.screen);
    // The cursor opens each later screen from the sidebar, like someone using the app.
    const navClick = i > 0 && action ? at(0.13) : undefined;
    const actStart = at(0.46);
    const actEnd = at(0.78);
    return {
      start: from,
      end: from + duration,
      swap: navClick ?? from,
      navClick,
      nav: (i + 1) % navCount,
      pushStart: at(0.24),
      pushEnd: at(0.44),
      actStart,
      actEnd,
      pullStart: at(0.86),
      dragStart: actStart + 4,
      dragEnd: actEnd - 3,
      clickAt: actStart + 5,
      action,
    };
  });
}

function cameraKeys(plans: Plan[]): Key<"x" | "y" | "z">[] {
  return plans.flatMap((p) => {
    if (!p.action) {
      // Slow push down an uploaded screenshot, then settle back out for the next cut.
      return [
        { at: p.start, ...WIDE },
        { at: p.pullStart, x: APP_W / 2, y: APP_H * 0.42, z: 1.18 },
        { at: p.end, ...WIDE },
      ];
    }
    const close = { x: p.action.focus.x, y: p.action.focus.y, z: p.action.zoom };
    return [
      { at: p.start, ...WIDE },
      { at: p.pushStart, ...WIDE },
      { at: p.pushEnd, ...close },
      { at: p.pullStart, ...close },
      { at: p.end, ...WIDE },
    ];
  });
}

function cursorKeys(plans: Plan[]): Key<"x" | "y">[] {
  const keys = plans.flatMap((p) => {
    if (!p.action) return [{ at: p.start, ...REST }];
    const nav = navPoint(p.nav);
    const { from, to } = p.action;
    const end = p.action.kind === "drag" && to ? to : from;
    return [
      { at: p.start, ...REST },
      ...(p.navClick ? [{ at: p.navClick - 2, ...nav }, { at: p.navClick + 3, ...nav }] : []),
      { at: p.pushStart, ...(p.navClick ? nav : REST) },
      { at: p.actStart, ...from },
      ...(p.action.kind === "drag" && to ? [{ at: p.dragStart, ...from }, { at: p.dragEnd, ...to }] : []),
      { at: p.pullStart, ...end },
      { at: p.end, ...REST },
    ];
  });
  // Very short scenes can squeeze keys together; keep them strictly in order.
  return keys.filter((k, i) => i === 0 || k.at > keys[i - 1].at);
}

function interaction(plan: Plan, frame: number): Interaction {
  if (!plan.action) return IDLE;
  const { kind } = plan.action;
  if (kind === "hover") return { ...IDLE, focus: tween(frame, plan.actStart, plan.actStart + 10) * (1 - tween(frame, plan.pullStart, plan.end - 2)) };
  if (kind === "click") return { ...IDLE, flip: tween(frame, plan.clickAt, plan.clickAt + 12) };
  return {
    ...IDLE,
    lift: tween(frame, plan.dragStart - 4, plan.dragStart) * (1 - tween(frame, plan.dragEnd, plan.dragEnd + 6)),
    travel: tween(frame, plan.dragStart, plan.dragEnd, 0, 1, EASE.inOut),
  };
}

// Frames where the cursor presses: nav clicks, the table click, and the drag's grab and release.
function presses(plans: Plan[]) {
  return plans.flatMap((p) => {
    const out: number[] = p.navClick ? [p.navClick] : [];
    if (p.action?.kind === "click") out.push(p.clickAt);
    return out;
  });
}

function useLayout() {
  const { width, height } = useVideoConfig();
  const landscape = width / height > 1.2;
  if (landscape) {
    const pad = width * 0.055;
    const textW = width * 0.27;
    const gap = width * 0.04;
    return { landscape, pad, textW, gap, deviceW: width - pad * 2 - textW - gap, title: 70, body: 30 };
  }
  const tall = height / width > 1.4;
  const pad = width * 0.065;
  const textH = tall ? 420 : 270;
  const gap = tall ? 90 : 46;
  const deviceW = Math.min(width - pad * 2, (height - pad * 2 - textH - gap - CHROME) * (APP_W / APP_H));
  return { landscape, pad, textW: deviceW, gap, deviceW, title: tall ? 84 : 56, body: tall ? 36 : 27 };
}

// All feature scenes play as one continuous screen recording: the app never leaves the frame,
// a camera pushes in on each feature, and a cursor actually uses the product.
export function ProductTake({ storyboard, spans }: { storyboard: Storyboard; spans: Span[] }) {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const plans = useMemo(() => buildPlans(storyboard, spans), [storyboard, spans]);
  const camKeys = useMemo(() => cameraKeys(plans), [plans]);
  const curKeys = useMemo(() => cursorKeys(plans), [plans]);
  const clicks = useMemo(() => presses(plans), [plans]);

  const current = Math.max(0, plans.findLastIndex((p) => p.start <= frame));
  const shown = Math.max(0, plans.findLastIndex((p) => p.swap <= frame));
  const plan = plans[current];

  const base = layout.deviceW / APP_W;
  const cam = track(frame, camKeys, ["x", "y", "z"]);
  const prev = track(frame - 1, camKeys, ["x", "y", "z"]);
  const view = (c: typeof cam) => {
    const w = APP_W / c.z;
    const h = APP_H / c.z;
    return { left: clamp(c.x - w / 2, 0, APP_W - w), top: clamp(c.y - h / 2, 0, APP_H - h), z: c.z };
  };
  const v = view(cam);
  const pv = view(prev);
  // Motion blur proportional to how far the picture moved since the last frame.
  const speed = Math.hypot((v.left - pv.left) * v.z, (v.top - pv.top) * v.z, (v.z - pv.z) * APP_W * 0.5) * base;
  const blur = Math.min(speed * 0.06, 2);

  const cursor = track(frame, curKeys, ["x", "y"]);
  const cursorVisible = (p: Plan) => !!p.action;
  const cursorOpacity =
    current === 0
      ? tween(frame, 16, 24) * (cursorVisible(plan) ? 1 : 0)
      : tween(frame, plan.start, plan.start + 6, cursorVisible(plans[current - 1]) ? 1 : 0, cursorVisible(plan) ? 1 : 0);
  const dragging = plan.action?.kind === "drag" && frame >= plan.dragStart - 3 && frame <= plan.dragEnd + 2;
  const press = Math.max(0, ...clicks.map((c) => bump(frame, c - 3, c + 4)));
  const ripple = clicks.find((c) => frame >= c && frame < c + 14);

  // The device rises in once, at the first feature, and then stays put.
  const rise = tween(frame, 0, 28);
  const accent = lighten(storyboard.brandColor, 0.35);

  // The previous screen stays underneath while the next one fades in.
  const screens = shown > 0 && frame < plans[shown].swap + SWAP ? [shown - 1, shown] : [shown];

  return (
    <AbsoluteFill
      style={{
        flexDirection: layout.landscape ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        padding: layout.pad,
        gap: layout.gap,
      }}
    >
      <ChapterText storyboard={storyboard} plans={plans} index={current} frame={frame} width={layout.textW} title={layout.title} body={layout.body} accent={accent} />

      <div
        style={{
          width: layout.deviceW,
          flexShrink: 0,
          borderRadius: 16,
          overflow: "hidden",
          background: "#ffffff",
          boxShadow: "0 60px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          opacity: tween(frame, 0, 10),
          transform: `perspective(2400px) translateY(${(1 - rise) * 160}px) rotateX(${(1 - rise) * 14}deg) scale(${0.94 + rise * 0.06})`,
        }}
      >
        <div style={{ height: CHROME, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
          {[0, 1, 2].map((d) => (
            <div key={d} style={{ width: 12, height: 12, borderRadius: 6, background: "#cbd5e1" }} />
          ))}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ padding: "5px 60px", borderRadius: 8, background: "#ffffff", color: "#64748b", fontSize: 14 }}>
              app.{storyboard.url.replace(/^https?:\/\//, "")}
            </div>
          </div>
          <div style={{ width: 52 }} />
        </div>

        <div style={{ position: "relative", width: layout.deviceW, height: layout.deviceW * (APP_H / APP_W), overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              width: APP_W,
              height: APP_H,
              transformOrigin: "0 0",
              transform: `scale(${base * v.z}) translate(${-v.left}px, ${-v.top}px)`,
              filter: blur > 0.3 ? `blur(${blur / (base * v.z)}px)` : undefined,
            }}
          >
            <AppSidebar navItems={storyboard.navItems} productName={storyboard.productName} brandColor={storyboard.brandColor} active={plans[shown].nav} />
            {screens.map((i) => {
              const p = plans[i];
              const incoming = i === shown;
              const fade = incoming ? (i === 0 ? 1 : tween(frame, p.swap, p.swap + SWAP)) : 1 - tween(frame, plans[shown].swap, plans[shown].swap + SWAP);
              const feature = storyboard.features[i];
              return (
                <div key={i} style={{ position: "absolute", inset: 0, opacity: fade, transform: `translateY(${incoming ? (1 - fade) * 14 : 0}px)` }}>
                  {feature.screenshot ? (
                    <Img src={feature.screenshot} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, background: "#ffffff", left: 241 }}>
                      <div style={{ position: "absolute", left: -241, top: 0 }}>
                        <AppMain screen={feature.screen} brandColor={storyboard.brandColor} age={frame - (i === 0 ? 10 : p.swap)} act={interaction(p, frame)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {ripple !== undefined && (
              <div
                style={{
                  position: "absolute",
                  left: cursor.x - 30,
                  top: cursor.y - 30,
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  border: `3px solid ${storyboard.brandColor}`,
                  opacity: (1 - tween(frame, ripple, ripple + 14)) * cursorOpacity,
                  transform: `scale(${0.3 + tween(frame, ripple, ripple + 14) * 1.1})`,
                }}
              />
            )}
            <Cursor x={cursor.x} y={cursor.y} opacity={cursorOpacity} scale={dragging ? 0.88 : 1 - press * 0.16} grab={dragging} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Cursor({ x, y, opacity, scale, grab }: { x: number; y: number; opacity: number; scale: number; grab: boolean }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      style={{ position: "absolute", left: x - 6, top: y - 3, opacity, transform: `scale(${scale})`, transformOrigin: "6px 3px", zIndex: 5 }}
    >
      {grab ? (
        <path
          d="M8 9V6.5a1.5 1.5 0 0 1 3 0V9m0-3.5V5a1.5 1.5 0 0 1 3 0v4m0-3a1.5 1.5 0 0 1 3 0v3.5m0-1.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 16.5a1.6 1.6 0 0 1 2.4-2.1L8 16V9"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      ) : (
        <path d="M6 3l13 7.4-5.6 1.4 3.4 6.6-2.6 1.3-3.4-6.6L6.6 17.2z" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  );
}

type TextProps = { storyboard: Storyboard; plans: Plan[]; index: number; frame: number; width: number; title: number; body: number; accent: string };

// Headline and line for the feature on screen, swapped with a masked wipe at each chapter.
function ChapterText({ storyboard, plans, index, frame, width, title, body, accent }: TextProps) {
  const plan = plans[index];
  const feature = storyboard.features[index];
  const enter = plan.start + (index === 0 ? 10 : 3);
  const exit = index < plans.length - 1 ? plan.end - 7 : undefined;
  const line = tween(frame, enter + 8, enter + 24);
  const lineOut = exit === undefined ? 0 : tween(frame, exit, exit + 6, 0, 1, EASE.inOut);
  return (
    <div style={{ width, flexShrink: 0, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {plans.map((p, i) => (
          <div key={i} style={{ width: 44, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: accent, width: `${(i < index ? 1 : i > index ? 0 : tween(frame, p.start, p.end, 0, 1, EASE.linear)) * 100}%` }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: title, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.035em" }}>
        <Masked key={index} text={feature.title} frame={frame} start={enter} stagger={1.6} exit={exit} />
      </div>
      <div style={{ fontSize: body, lineHeight: 1.4, color: "rgba(255,255,255,0.62)", marginTop: 26, opacity: line * (1 - lineOut), transform: `translateY(${(1 - line) * 14 - lineOut * 10}px)` }}>
        {feature.description}
      </div>
    </div>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
