import type { ReactNode } from "react";
import { AbsoluteFill, Img, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AppScreen, countUp } from "./AppScreen";
import type { Feature, LaunchVideoProps, Storyboard } from "./types";

export const FPS = 30;

const INTRO = 90;
const PROBLEM = 80;
const FEATURE = 120;
const STATS = 90;
const CTA = 105;

const FONT = "var(--font-geist-sans), Inter, Arial, sans-serif";

export type TimelineScene = { key: string; label: string; from: number; duration: number };

// Scene timings, optionally stretched or squeezed to hit a target length in seconds.
export function launchTimeline(storyboard: Storyboard, seconds?: number): TimelineScene[] {
  const natural = INTRO + PROBLEM + storyboard.features.length * FEATURE + STATS + CTA;
  const scale = seconds ? (seconds * FPS) / natural : 1;
  const parts: [string, string, number][] = [
    ["hook", "Hook", INTRO],
    ["problem", "Problem", PROBLEM],
    ...storyboard.features.map((f, i): [string, string, number] => [`feature-${i}`, f.title, FEATURE]),
    ["stats", "Proof", STATS],
    ["cta", storyboard.cta, CTA],
  ];
  let from = 0;
  return parts.map(([key, label, frames]) => {
    const duration = Math.round(frames * scale);
    const scene = { key, label, from, duration };
    from += duration;
    return scene;
  });
}

export function launchDuration(storyboard: Storyboard, seconds?: number) {
  const last = launchTimeline(storyboard, seconds).at(-1)!;
  return last.from + last.duration;
}

export function LaunchVideo({ storyboard: s, seconds }: LaunchVideoProps) {
  const timeline = launchTimeline(s, seconds);
  const frames = (key: string) => timeline.find((t) => t.key === key)!.duration;
  return (
    <AbsoluteFill style={{ background: "#0a0a12", color: "#ffffff", fontFamily: FONT }}>
      <Backdrop color={s.brandColor} />
      <Series>
        <Series.Sequence durationInFrames={frames("hook")}>
          <Scene duration={frames("hook")}>
            <Intro storyboard={s} />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames("problem")}>
          <Scene duration={frames("problem")}>
            <Problem text={s.problem} />
          </Scene>
        </Series.Sequence>
        {s.features.map((feature, i) => (
          <Series.Sequence key={i} durationInFrames={frames(`feature-${i}`)}>
            <Scene duration={frames(`feature-${i}`)}>
              <FeatureScene feature={feature} index={i} storyboard={s} />
            </Scene>
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={frames("stats")}>
          <Scene duration={frames("stats")}>
            <Stats storyboard={s} />
          </Scene>
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames("cta")}>
          <Scene duration={frames("cta")} fadeOut={false}>
            <Cta storyboard={s} />
          </Scene>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}

function usePortrait() {
  const { width, height } = useVideoConfig();
  return height > width;
}

// Fades each scene in and out so cuts feel smooth.
function Scene({ duration, fadeOut = true, children }: { duration: number; fadeOut?: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, fadeOut ? [0, 10, duration - 10, duration] : [0, 10], fadeOut ? [0, 1, 1, 0] : [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function Backdrop({ color }: { color: string }) {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 80;
  const blob = { position: "absolute" as const, width: 900, height: 900, borderRadius: "50%", filter: "blur(160px)" };
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ ...blob, background: color, opacity: 0.35, left: -300 + drift, top: -350 }} />
      <div style={{ ...blob, background: "#22d3ee", opacity: 0.12, right: -350 - drift, bottom: -400 }} />
    </AbsoluteFill>
  );
}

function Logo({ storyboard, size }: { storyboard: Storyboard; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: `linear-gradient(135deg, ${storyboard.brandColor}, ${storyboard.brandColor}99)`,
        boxShadow: `0 20px 60px ${storyboard.brandColor}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
        fontWeight: 800,
      }}
    >
      {storyboard.productName.charAt(0).toUpperCase()}
    </div>
  );
}

function Intro({ storyboard }: { storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const title = spring({ frame: frame - 12, fps, config: { damping: 200 } });
  const tagline = spring({ frame: frame - 26, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100, gap: 40 }}>
      <div style={{ transform: `scale(${pop})` }}>
        <Logo storyboard={storyboard} size={170} />
      </div>
      <div
        style={{
          fontSize: portrait ? 130 : 140,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          opacity: title,
          transform: `translateY(${(1 - title) * 50}px)`,
        }}
      >
        {storyboard.productName}
      </div>
      <div style={{ fontSize: 50, maxWidth: 1300, lineHeight: 1.25, opacity: tagline * 0.8, transform: `translateY(${(1 - tagline) * 30}px)` }}>
        {storyboard.tagline}
      </div>
    </AbsoluteFill>
  );
}

function Problem({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120 }}>
      <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", textAlign: "center", maxWidth: 1500 }}>
        {words.map((word, i) => {
          const p = interpolate(frame - i * 3, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={i} style={{ display: "inline-block", marginRight: "0.25em", opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 18,
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ height: 46, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", background: "#e2e8f0" }}>
        {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
        ))}
        <div style={{ marginLeft: 20, padding: "5px 18px", borderRadius: 8, background: "#ffffff", color: "#64748b", fontSize: 15 }}>{url}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
    </div>
  );
}

function FeatureScene({ feature, index, storyboard }: { feature: Feature; index: number; storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const text = spring({ frame, fps, config: { damping: 200 } });
  const screen = spring({ frame: frame - 6, fps, config: { damping: 18, mass: 0.9 } });
  const float = Math.sin(frame / 25) * 6;
  const reverse = !portrait && index % 2 === 1;

  return (
    <AbsoluteFill
      style={{
        flexDirection: portrait ? "column" : reverse ? "row-reverse" : "row",
        alignItems: "center",
        padding: portrait ? "160px 70px" : "100px 110px",
        gap: portrait ? 70 : 90,
      }}
    >
      <div
        style={{
          width: portrait ? "100%" : "34%",
          flexShrink: 0,
          opacity: text,
          transform: `translateX(${(1 - text) * (reverse ? 60 : -60)}px)`,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.12em", color: storyboard.brandColor, filter: "brightness(1.4)" }}>
          FEATURE {String(index + 1).padStart(2, "0")}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", marginTop: 20 }}>{feature.title}</div>
        <div style={{ fontSize: 36, lineHeight: 1.35, opacity: 0.7, marginTop: 26 }}>{feature.description}</div>
      </div>

      <div
        style={{
          flex: 1,
          width: portrait ? "100%" : undefined,
          height: portrait ? undefined : 760,
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          opacity: screen,
          transform: `perspective(2200px) rotateY(${(1 - screen) * (reverse ? 22 : -22)}deg) translateX(${(1 - screen) * (reverse ? -160 : 160)}px) translateY(${float}px)`,
        }}
      >
        <div style={{ width: "100%", height: portrait ? 900 : 760 }}>
          <BrowserFrame url={`app.${storyboard.url.replace(/^https?:\/\//, "")}`}>
            {feature.screenshot ? (
              <Img src={feature.screenshot} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
            ) : (
              <AppScreen
                screen={feature.screen}
                navItems={storyboard.navItems}
                productName={storyboard.productName}
                brandColor={storyboard.brandColor}
                activeNav={(index + 1) % Math.max(storyboard.navItems.length, 1)}
              />
            )}
          </BrowserFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Stats({ storyboard }: { storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 100 }}>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: 50, width: "100%", maxWidth: 1600 }}>
        {storyboard.stats.map((stat, i) => {
          const enter = spring({ frame: frame - i * 8, fps, config: { damping: 200 } });
          const count = interpolate(frame - i * 8, [0, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "56px 40px",
                borderRadius: 28,
                textAlign: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                opacity: enter,
                transform: `translateY(${(1 - enter) * 60}px)`,
              }}
            >
              <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.04em" }}>{countUp(stat.value, 1 - Math.pow(1 - count, 3))}</div>
              <div style={{ fontSize: 34, opacity: 0.7, marginTop: 10 }}>{stat.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Cta({ storyboard }: { storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const button = spring({ frame: frame - 18, fps, config: { damping: 12 } });
  const pulse = 1 + Math.sin(frame / 8) * 0.025 * Math.min(1, Math.max(0, (frame - 35) / 10));

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100, gap: 50 }}>
      <div style={{ transform: `scale(${enter})` }}>
        <Logo storyboard={storyboard} size={130} />
      </div>
      <div style={{ fontSize: 100, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: 1500, opacity: enter }}>
        {storyboard.cta}
      </div>
      <div
        style={{
          padding: "28px 64px",
          borderRadius: 999,
          fontSize: 46,
          fontWeight: 700,
          background: storyboard.brandColor,
          boxShadow: `0 20px 60px ${storyboard.brandColor}80`,
          transform: `scale(${button * pulse})`,
        }}
      >
        {storyboard.url}
      </div>
    </AbsoluteFill>
  );
}
