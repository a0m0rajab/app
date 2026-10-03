"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { type ChangeEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { FPS, LaunchVideo, launchTimeline } from "@/remotion/LaunchVideo";
import type { Feature, Storyboard } from "@/remotion/types";
import { DownloadIcon, ErrorNote, Eyebrow, PrimaryButton, SecondaryButton } from "./ui";
import { FORMATS, type LaunchOptions } from "./options";

type RenderState =
  | { state: "idle" }
  | { state: "rendering"; progress: number }
  | { state: "done"; url: string; storyboard: Storyboard; options: LaunchOptions }
  | { state: "error"; message: string };

type Props = {
  storyboard: Storyboard;
  options: LaunchOptions;
  error: string;
  generating: boolean;
  onOptions: (patch: Partial<LaunchOptions>) => void;
  onUpdate: (patch: Partial<Storyboard>) => void;
  onUpdateFeature: (index: number, patch: Partial<Feature>) => void;
  onRegenerate: () => void;
  onBack: () => void;
};

const field =
  "w-full rounded-[10px] border border-edge bg-white px-4 py-3 text-base/6 text-ink outline-none transition-shadow focus:border-ink focus:shadow-[0_0_0_0.5px_#0E0E0E]";

const clock = (frame: number) => {
  const s = Math.floor(frame / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const slug = (name: string) => name.toLowerCase().replace(/\W+/g, "-");

export function PreviewStep({ storyboard, options, error, generating, onOptions, onUpdate, onUpdateFeature, onRegenerate, onBack }: Props) {
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState("hook");
  const [renderState, setRender] = useState<RenderState>({ state: "idle" });
  // Any edit after a render makes the finished file stale.
  const stale = renderState.state === "done" && (renderState.storyboard !== storyboard || renderState.options !== options);
  const render: RenderState = stale ? { state: "idle" } : renderState;
  const abortRef = useRef<AbortController | null>(null);

  const { seconds } = options;
  const format = FORMATS[options.format];
  const timeline = useMemo(() => launchTimeline(storyboard, seconds), [storyboard, seconds]);
  const total = timeline.at(-1)!.from + timeline.at(-1)!.duration;
  const sceneIndex = Math.max(0, timeline.findIndex((t) => t.key === selected));
  const scene = timeline[sceneIndex];

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      setFrame(e.detail.frame);
      if (p.isPlaying()) {
        const current = timeline.findLast((t) => t.from <= e.detail.frame);
        if (current) setSelected(current.key);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [timeline]);

  function jumpTo(key: string) {
    const t = timeline.find((s) => s.key === key)!;
    setSelected(key);
    player.current?.pause();
    player.current?.seekTo(t.from + Math.min(30, t.duration - 1));
  }

  function seek(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const target = Math.round(((e.clientX - rect.left) / rect.width) * (total - 1));
    player.current?.seekTo(target);
    const current = timeline.findLast((t) => t.from <= target);
    if (current) setSelected(current.key);
  }

  function onScreenshot(index: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateFeature(index, { screenshot: reader.result as string });
    reader.readAsDataURL(file);
  }

  async function exportVideo() {
    if (render.state === "done") return download(render.url);
    if (renderState.state === "done") URL.revokeObjectURL(renderState.url);
    const controller = new AbortController();
    abortRef.current = controller;
    setRender({ state: "rendering", progress: 0 });
    try {
      const { renderMediaOnWeb } = await import("@remotion/web-renderer");
      const props = { storyboard, seconds };
      const { getBlob } = await renderMediaOnWeb({
        composition: { id: "launch-video", component: LaunchVideo, durationInFrames: total, fps: FPS, width: format.width, height: format.height, defaultProps: props },
        inputProps: props,
        signal: controller.signal,
        onProgress: ({ progress }) => setRender({ state: "rendering", progress }),
      });
      const url = URL.createObjectURL(await getBlob());
      setRender({ state: "done", url, storyboard, options });
      download(url);
    } catch (err) {
      setRender(controller.signal.aborted ? { state: "idle" } : { state: "error", message: (err as Error).message });
    }
  }

  function download(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(storyboard.productName)}-launch-${format.short.replace(":", "x")}.mp4`;
    a.click();
  }

  const featureIndex = scene.key.startsWith("feature-") ? Number(scene.key.slice(8)) : -1;
  const feature = storyboard.features[featureIndex];
  const progress = render.state === "rendering" ? Math.round(render.progress * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 pt-10 pb-12 sm:px-14 lg:flex-row lg:gap-14">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-2xl bg-ink p-4 sm:p-6">
          <Player
            ref={player}
            component={LaunchVideo}
            inputProps={{ storyboard, seconds }}
            durationInFrames={total}
            fps={FPS}
            compositionWidth={format.width}
            compositionHeight={format.height}
            loop
            clickToPlay
            acknowledgeRemotionLicense
            style={{ width: "100%", maxHeight: "60vh", aspectRatio: `${format.width} / ${format.height}`, borderRadius: 10, overflow: "hidden" }}
          />
          <div className="flex items-center gap-4 pl-0.5">
            <button
              type="button"
              onClick={() => player.current?.toggle()}
              aria-label={playing ? "Pause" : "Play"}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sun hover:brightness-95"
            >
              <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
                {playing ? (
                  <>
                    <rect x="1" y="1" width="3.5" height="12" rx="1" fill="#0E0E0E" />
                    <rect x="7.5" y="1" width="3.5" height="12" rx="1" fill="#0E0E0E" />
                  </>
                ) : (
                  <path d="M1.5 1 L11 7 L1.5 13 Z" fill="#0E0E0E" />
                )}
              </svg>
            </button>
            <span className="shrink-0 font-mono text-[13px]/4 text-white tabular-nums">
              {clock(frame)} / {clock(total)}
            </span>
            <div onClick={seek} className="group flex h-4 flex-1 cursor-pointer items-center" role="presentation">
              <div className="h-1 w-full rounded-xs bg-white/20 transition-[height] group-hover:h-1.5">
                <div className="h-full rounded-xs bg-sun" style={{ width: `${(frame / Math.max(total - 1, 1)) * 100}%` }} />
              </div>
            </div>
            <span className="hidden shrink-0 text-[13px]/4 font-semibold text-white sm:inline">{format.short} · 1080p</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Scenes</Eyebrow>
            <span className="text-[13px]/4 text-muted">Click a scene to edit its line</span>
          </div>
          <div className="flex h-21 shrink-0 gap-1.5 overflow-x-auto">
            {timeline.map((t, i) => {
              const active = t.key === selected;
              const last = i === timeline.length - 1;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => jumpTo(t.key)}
                  style={{ flexGrow: t.duration }}
                  className={`flex min-w-24 basis-0 flex-col justify-between rounded-[10px] p-3 text-left transition-colors ${
                    active
                      ? "border-[1.5px] border-ink bg-sun font-bold"
                      : last
                        ? "bg-ink font-semibold text-white"
                        : "bg-paper font-semibold hover:bg-line"
                  }`}
                >
                  <span className={`font-mono text-xs/4 font-normal ${active ? "text-ink" : last ? "text-dash" : "text-muted"}`}>{clock(t.from)}</span>
                  <span className="truncate text-sm/4.5">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-8 lg:w-95">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-sm ${generating ? "animate-pulse bg-sun" : "bg-go"}`} />
            <Eyebrow muted>{generating ? "Rewriting your script…" : "Step 2 of 2 — Ready"}</Eyebrow>
          </div>
          <h1 className="text-5xl/12 font-extrabold tracking-[-0.035em]">
            {storyboard.productName}, in {seconds} seconds.
          </h1>
        </div>

        <div key={scene.key} className="flex flex-col gap-3">
          <Eyebrow>
            Scene {sceneIndex + 1} · {scene.key === "cta" ? "Call to action" : scene.label}
          </Eyebrow>
          {scene.key === "hook" && (
            <textarea value={storyboard.tagline} onChange={(e) => onUpdate({ tagline: e.target.value })} rows={3} aria-label="Tagline" className={`${field} resize-y`} />
          )}
          {scene.key === "problem" && (
            <textarea value={storyboard.problem} onChange={(e) => onUpdate({ problem: e.target.value })} rows={3} aria-label="Problem" className={`${field} resize-y`} />
          )}
          {feature && (
            <>
              <input value={feature.title} onChange={(e) => onUpdateFeature(featureIndex, { title: e.target.value })} aria-label="Headline" className={`${field} font-semibold`} />
              <textarea
                value={feature.description}
                onChange={(e) => onUpdateFeature(featureIndex, { description: e.target.value })}
                rows={3}
                aria-label="Line"
                className={`${field} resize-y`}
              />
              <div className="flex gap-4 text-sm/4.5 font-semibold">
                {feature.screenshot ? (
                  <button type="button" onClick={() => onUpdateFeature(featureIndex, { screenshot: undefined })} className="underline underline-offset-3 hover:text-muted">
                    Use generated screen
                  </button>
                ) : (
                  <label className="cursor-pointer underline underline-offset-3 hover:text-muted">
                    Upload screenshot
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onScreenshot(featureIndex, e)} className="hidden" />
                  </label>
                )}
              </div>
            </>
          )}
          {scene.key === "stats" &&
            storyboard.stats.map((stat, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={stat.value}
                  onChange={(e) => onUpdate({ stats: storyboard.stats.map((s, j) => (j === i ? { ...s, value: e.target.value } : s)) })}
                  aria-label={`Stat ${i + 1} value`}
                  className={`${field} w-28 shrink-0 font-semibold`}
                />
                <input
                  value={stat.label}
                  onChange={(e) => onUpdate({ stats: storyboard.stats.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)) })}
                  aria-label={`Stat ${i + 1} label`}
                  className={field}
                />
              </div>
            ))}
          {scene.key === "cta" && (
            <>
              <input value={storyboard.cta} onChange={(e) => onUpdate({ cta: e.target.value })} aria-label="Call to action" className={`${field} font-semibold`} />
              <input value={storyboard.url} onChange={(e) => onUpdate({ url: e.target.value })} aria-label="URL" className={field} />
            </>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-end gap-3">
          {error && <ErrorNote>{error}</ErrorNote>}
          {render.state === "error" && <ErrorNote>{render.message}</ErrorNote>}
          <PrimaryButton type="button" onClick={exportVideo} disabled={render.state === "rendering"} className="relative overflow-hidden disabled:opacity-100">
            {render.state === "rendering" && <span className="absolute inset-y-0 left-0 bg-sun-soft" style={{ width: `${progress}%` }} />}
            <span className="relative flex items-center gap-3">
              <DownloadIcon />
              {render.state === "rendering" ? `Rendering… ${progress}%` : render.state === "done" ? "Download again" : "Download MP4"}
            </span>
          </PrimaryButton>
          <div className="flex gap-2.5">
            <SecondaryButton type="button" onClick={onRegenerate} disabled={generating || render.state === "rendering"} className="flex-1">
              {generating ? "Rewriting…" : "Rewrite script"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => onOptions({ format: options.format === "portrait" ? "landscape" : "portrait" })}
              disabled={render.state === "rendering"}
              className="flex-1"
            >
              {options.format === "portrait" ? "Make 16:9 cut" : "Make 9:16 cut"}
            </SecondaryButton>
          </div>
          <div className="pt-1 text-center text-[13px]/4 text-muted">
            {render.state === "rendering" ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="hover:text-ink">
                Cancel render · it runs in your browser
              </button>
            ) : (
              <button type="button" onClick={onBack} className="hover:text-ink">
                ← Back to product
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
