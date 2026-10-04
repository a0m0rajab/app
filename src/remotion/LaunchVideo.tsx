import type { ReactNode } from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, Series, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { countUp } from "./AppScreen";
import { Masked } from "./Kinetic";
import { BEAT, EASE, FPS, lighten, tween } from "./motion";
import { ProductTake } from "./ProductTake";
import type { LaunchVideoProps, Storyboard } from "./types";

export { FPS };

// Natural scene lengths, in beats of the music.
const BEATS = { hook: 6, problem: 5, feature: 8, stats: 6, cta: 7 };
const MIN_BEATS = 2;

const FONT = "var(--font-inter-tight), var(--font-geist-sans), Inter, Arial, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
const STAGE = "#09090b";

export type TimelineScene = { key: string; label: string; from: number; duration: number };

// Scene timings, quantised to whole beats so every cut lands on the music, and fitted to a target length in seconds.
export function launchTimeline(storyboard: Storyboard, seconds?: number): TimelineScene[] {
  const parts: [string, string, number][] = [
    ["hook", "Hook", BEATS.hook],
    ["problem", "Problem", BEATS.problem],
    ...storyboard.features.map((f, i): [string, string, number] => [`feature-${i}`, f.title, BEATS.feature]),
    ["stats", "Proof", BEATS.stats],
    ["cta", storyboard.cta, BEATS.cta],
  ];
  const natural = parts.reduce((sum, [, , b]) => sum + b, 0);
  const target = seconds ? Math.max(parts.length * MIN_BEATS, Math.round((seconds * FPS) / BEAT)) : natural;
  const ideal = parts.map(([, , b]) => (b * target) / natural);
  const beats = ideal.map((v) => Math.max(MIN_BEATS, Math.floor(v)));
  // Largest remainder: hand leftover beats to the scenes rounded down the most, or take them from the longest.
  let left = target - beats.reduce((a, b) => a + b, 0);
  const order = ideal.map((v, i) => [v - beats[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) beats[order[k % order.length][1]]++;
  while (left < 0) {
    beats[beats.indexOf(Math.max(...beats))]--;
    left++;
  }
  let from = 0;
  return parts.map(([key, label], i) => {
    const scene = { key, label, from, duration: beats[i] * BEAT };
    from += scene.duration;
    return scene;
  });
}

export function launchDuration(storyboard: Storyboard, seconds?: number) {
  const last = launchTimeline(storyboard, seconds).at(-1)!;
  return last.from + last.duration;
}

export function LaunchVideo({ storyboard: s, seconds, audio }: LaunchVideoProps) {
  const timeline = launchTimeline(s, seconds);
  const frames = (key: string) => timeline.find((t) => t.key === key)!.duration;
  const features = timeline.filter((t) => t.key.startsWith("feature-"));
  const takeStart = features[0]?.from ?? 0;
  const spans = features.map((t) => ({ from: t.from - takeStart, duration: t.duration }));
  const takeLength = spans.reduce((sum, t) => sum + t.duration, 0);

  return (
    <AbsoluteFill style={{ background: STAGE, color: "#ffffff", fontFamily: FONT }}>
      <Backdrop color={s.brandColor} />
      <Soundtrack music={audio?.music} voiceover={audio?.voiceover} />
      <Series>
        <Series.Sequence durationInFrames={frames("hook")}>
          <Cut duration={frames("hook")}>
            <Intro storyboard={s} />
          </Cut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames("problem")}>
          <Cut duration={frames("problem")}>
            <Problem text={s.problem} accent={lighten(s.brandColor, 0.35)} />
          </Cut>
        </Series.Sequence>
        {takeLength > 0 && (
          <Series.Sequence durationInFrames={takeLength}>
            <ProductTake storyboard={s} spans={spans} />
          </Series.Sequence>
        )}
        <Series.Sequence durationInFrames={frames("stats")}>
          <Cut duration={frames("stats")}>
            <Stats storyboard={s} />
          </Cut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames("cta")}>
          <Cut duration={frames("cta")}>
            <Cta storyboard={s} />
          </Cut>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}

const VOICE_DELAY = 12;

// Music bed ducks under the voiceover and fades out with the final scene.
function Soundtrack({ music, voiceover }: { music?: string; voiceover?: string }) {
  const { durationInFrames, fps } = useVideoConfig();
  const level = voiceover ? 0.22 : 0.6;
  const musicVolume = (f: number) =>
    interpolate(f, [0, fps * 0.5, durationInFrames - fps * 1.5, durationInFrames], [0, level, level, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  return (
    <>
      {music && <Audio src={music} loop loopVolumeCurveBehavior="extend" volume={musicVolume} />}
      {voiceover && (
        <Sequence from={VOICE_DELAY} layout="none">
          <Audio src={voiceover} />
        </Sequence>
      )}
    </>
  );
}

function usePortrait() {
  const { width, height } = useVideoConfig();
  return height > width;
}

// Scenes hard-cut on the beat: each one punches in slightly and keeps drifting closer, so nothing sits still.
function Cut({ duration, children }: { duration: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const scale = tween(frame, 0, 10, 1.035, 1) * tween(frame, 0, duration, 1, 1.03, EASE.linear);
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
}

// A flat stage with a faint wash of the brand colour from above.
function Backdrop({ color }: { color: string }) {
  return <AbsoluteFill style={{ background: `linear-gradient(180deg, ${color}1f 0%, ${color}00 55%)` }} />;
}

function Logo({ storyboard, size }: { storyboard: Storyboard; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: `linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%), ${storyboard.brandColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.52,
        fontWeight: 800,
        letterSpacing: "-0.04em",
      }}
    >
      {storyboard.productName.charAt(0).toUpperCase()}
    </div>
  );
}

function Intro({ storyboard }: { storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const mark = tween(frame, 0, 14);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100, gap: 36 }}>
      <div style={{ opacity: mark, transform: `scale(${0.8 + mark * 0.2}) rotate(${(1 - mark) * -8}deg)` }}>
        <Logo storyboard={storyboard} size={portrait ? 120 : 104} />
      </div>
      <div style={{ fontSize: portrait ? 150 : 176, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>
        <Masked text={storyboard.productName} frame={frame} start={4} stagger={1.2} duration={18} chars />
      </div>
      <div style={{ fontSize: portrait ? 46 : 44, maxWidth: portrait ? 900 : 1300, lineHeight: 1.3, color: "rgba(255,255,255,0.66)" }}>
        <Masked text={storyboard.tagline} frame={frame} start={18} stagger={1.4} />
      </div>
    </AbsoluteFill>
  );
}

function Problem({ text, accent }: { text: string; accent: string }) {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const words = text.split(/\s+/).filter(Boolean).length;
  // Land the words on a steady half-beat pulse, finishing well before the cut.
  const stagger = Math.min(BEAT / 2, 40 / Math.max(words, 1));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: portrait ? 80 : 140 }}>
      <div style={{ fontSize: portrait ? 96 : 104, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.035em", textAlign: "center", maxWidth: 1500 }}>
        <Masked text={text} frame={frame} start={2} stagger={stagger} duration={10} colorAt={(i, n) => (i === n - 1 ? accent : undefined)} />
      </div>
    </AbsoluteFill>
  );
}

// One stat at a time, each a hard cut, counting up to its number.
function Stats({ storyboard }: { storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const portrait = usePortrait();
  const stats = storyboard.stats;
  if (!stats.length) return null;
  const slot = durationInFrames / stats.length;
  const index = Math.min(stats.length - 1, Math.floor(frame / slot));
  const local = frame - index * slot;
  const stat = stats[index];
  // Start partway up so the first frame of each cut never reads as zero.
  const count = tween(local, 0, slot * 0.7, 0.3, 1);
  const bar = tween(local, 4, slot * 0.8, 0, 1, EASE.inOut);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>
        {String(index + 1).padStart(2, "0")} / {String(stats.length).padStart(2, "0")}
      </div>
      <div style={{ fontSize: portrait ? 230 : 280, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 0.95, fontVariantNumeric: "tabular-nums" }}>
        {countUp(stat.value, count)}
      </div>
      <div style={{ width: 420, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", marginTop: 40, overflow: "hidden" }}>
        <div style={{ width: `${bar * 100}%`, height: "100%", background: lighten(storyboard.brandColor, 0.2) }} />
      </div>
      <div style={{ fontSize: portrait ? 50 : 48, color: "rgba(255,255,255,0.72)", marginTop: 36 }}>
        <Masked key={index} text={stat.label} frame={local} start={3} stagger={1.5} />
      </div>
    </AbsoluteFill>
  );
}

function Cta({ storyboard }: { storyboard: Storyboard }) {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const lockup = tween(frame, 0, 16);
  const pill = tween(frame, 14, 28);
  const url = storyboard.url.replace(/^https?:\/\//, "");
  // The address types itself out, with a caret blinking on the beat.
  const typed = Math.floor(tween(frame, 20, 20 + url.length * 1.4, 0, url.length, EASE.linear));
  const caret = Math.floor(frame / (BEAT / 2)) % 2 === 0;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 100, gap: 54 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: lockup, transform: `translateY(${(1 - lockup) * 20}px)` }}>
        <Logo storyboard={storyboard} size={76} />
        <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em" }}>{storyboard.productName}</span>
      </div>
      <div style={{ fontSize: portrait ? 96 : 112, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.04, maxWidth: 1500 }}>
        <Masked text={storyboard.cta} frame={frame} start={6} stagger={1.8} />
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 40,
          padding: "22px 44px",
          borderRadius: 999,
          background: "#ffffff",
          color: STAGE,
          opacity: pill,
          transform: `scale(${0.92 + pill * 0.08})`,
        }}
      >
        {url.slice(0, typed)}
        <span style={{ display: "inline-block", width: 3, height: "1em", marginLeft: 4, verticalAlign: "-0.12em", background: storyboard.brandColor, opacity: caret ? 1 : 0 }} />
      </div>
    </AbsoluteFill>
  );
}
