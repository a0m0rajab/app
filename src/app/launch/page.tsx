"use client";

import { Player } from "@remotion/player";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { FPS, LaunchVideo, launchDuration } from "@/remotion/LaunchVideo";
import { SAMPLE_STORYBOARD, type Feature, type Storyboard } from "@/remotion/types";

const FORMATS = {
  landscape: { label: "16:9 landscape", width: 1920, height: 1080 },
  portrait: { label: "9:16 portrait", width: 1080, height: 1920 },
};

type Format = keyof typeof FORMATS;

type RenderState =
  | { state: "idle" }
  | { state: "rendering"; progress: number }
  | { state: "done"; url: string }
  | { state: "error"; message: string };

const field =
  "w-full rounded-xl border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20";
const label = "flex flex-col gap-1.5 text-sm";

export default function LaunchPage() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [brandColor, setBrandColor] = useState(SAMPLE_STORYBOARD.brandColor);
  const [format, setFormat] = useState<Format>("landscape");
  const [base, setBase] = useState<Storyboard>(SAMPLE_STORYBOARD);
  const [isSample, setIsSample] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [render, setRender] = useState<RenderState>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  // Name and colour stay live so tweaks show up in the preview instantly.
  const storyboard = useMemo<Storyboard>(
    () => ({ ...base, productName: productName.trim() || base.productName, brandColor }),
    [base, productName, brandColor],
  );
  const { width, height } = FORMATS[format];
  const durationInFrames = launchDuration(storyboard);
  const rendering = render.state === "rendering";

  function update(patch: Partial<Storyboard>) {
    setBase((s) => ({ ...s, ...patch }));
    resetRender();
  }

  function updateFeature(index: number, patch: Partial<Feature>) {
    setBase((s) => ({ ...s, features: s.features.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));
    resetRender();
  }

  function resetRender() {
    setRender((r) => {
      if (r.state === "done") URL.revokeObjectURL(r.url);
      return r.state === "rendering" ? r : { state: "idle" };
    });
  }

  function onScreenshot(index: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateFeature(index, { screenshot: reader.result as string });
    reader.readAsDataURL(file);
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!productName.trim() || !description.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, description, audience, brandColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBase(data.storyboard);
      setIsSample(false);
      resetRender();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function exportVideo() {
    const controller = new AbortController();
    abortRef.current = controller;
    resetRender();
    setRender({ state: "rendering", progress: 0 });
    try {
      const { renderMediaOnWeb } = await import("@remotion/web-renderer");
      const { getBlob } = await renderMediaOnWeb({
        composition: { id: "launch-video", component: LaunchVideo, durationInFrames, fps: FPS, width, height, defaultProps: { storyboard } },
        inputProps: { storyboard },
        signal: controller.signal,
        onProgress: ({ progress }) => setRender({ state: "rendering", progress }),
      });
      const blob = await getBlob();
      setRender({ state: "done", url: URL.createObjectURL(blob) });
    } catch (err) {
      setRender(controller.signal.aborted ? { state: "idle" } : { state: "error", message: (err as Error).message });
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <form onSubmit={generate} className="space-y-4">
            <h2 className="text-lg font-semibold">Your product</h2>
            <label className={label}>
              <span className="opacity-70">Product name</span>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Orbit" className={field} />
            </label>
            <label className={label}>
              <span className="opacity-70">What does it do?</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Project management for remote teams with automatic status reports…"
                className={`${field} resize-y`}
              />
            </label>
            <label className={label}>
              <span className="opacity-70">Target audience (optional)</span>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Startup engineering leads" className={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                <span className="opacity-70">Brand colour</span>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-black/15 bg-transparent dark:border-white/20"
                />
              </label>
              <label className={label}>
                <span className="opacity-70">Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={field}>
                  {Object.entries(FORMATS).map(([key, f]) => (
                    <option key={key} value={key}>{f.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={generating || !productName.trim() || !description.trim()}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {generating ? "Writing storyboard…" : "Generate launch video"}
            </button>
            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>
            )}
          </form>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              Storyboard {isSample && <span className="text-sm font-normal opacity-50">(sample)</span>}
            </h2>
            <label className={label}>
              <span className="opacity-70">Tagline</span>
              <input value={base.tagline} onChange={(e) => update({ tagline: e.target.value })} className={field} />
            </label>
            <label className={label}>
              <span className="opacity-70">Problem</span>
              <input value={base.problem} onChange={(e) => update({ problem: e.target.value })} className={field} />
            </label>

            {base.features.map((feature, i) => (
              <fieldset key={i} className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10">
                <legend className="px-1 text-sm font-medium">Screen {i + 1}</legend>
                <input
                  value={feature.title}
                  onChange={(e) => updateFeature(i, { title: e.target.value })}
                  aria-label={`Feature ${i + 1} title`}
                  className={field}
                />
                <input
                  value={feature.description}
                  onChange={(e) => updateFeature(i, { description: e.target.value })}
                  aria-label={`Feature ${i + 1} description`}
                  className={`${field} text-sm`}
                />
                <div className="flex items-center gap-3 text-sm">
                  {feature.screenshot ? (
                    <>
                      <span className="opacity-70">Using your screenshot</span>
                      <button type="button" onClick={() => updateFeature(i, { screenshot: undefined })} className="text-blue-600 hover:underline">
                        Use generated screen
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="opacity-70">Generated {feature.screen.kind} screen ·</span>
                      <label className="cursor-pointer text-blue-600 hover:underline">
                        Upload screenshot
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onScreenshot(i, e)} className="hidden" />
                      </label>
                    </>
                  )}
                </div>
              </fieldset>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                <span className="opacity-70">Call to action</span>
                <input value={base.cta} onChange={(e) => update({ cta: e.target.value })} className={field} />
              </label>
              <label className={label}>
                <span className="opacity-70">URL</span>
                <input value={base.url} onChange={(e) => update({ url: e.target.value })} className={field} />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-black">
            <Player
              component={LaunchVideo}
              inputProps={{ storyboard }}
              durationInFrames={durationInFrames}
              fps={FPS}
              compositionWidth={width}
              compositionHeight={height}
              controls
              loop
              acknowledgeRemotionLicense
              style={{ width: "100%", maxHeight: "70vh", aspectRatio: `${width} / ${height}` }}
            />
          </div>
          <p className="text-sm opacity-60">
            {(durationInFrames / FPS).toFixed(1)}s · {width}×{height} · {FPS}fps. Edits update the preview live.
          </p>

          {rendering ? (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.round(render.progress * 100)}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Rendering in your browser… {Math.round(render.progress * 100)}%</span>
                <button onClick={() => abortRef.current?.abort()} className="text-red-600 hover:underline">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={exportVideo} className="rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700">
                Export MP4
              </button>
              {render.state === "done" && (
                <a
                  href={render.url}
                  download={`${storyboard.productName.toLowerCase().replace(/\W+/g, "-")}-launch.mp4`}
                  className="rounded-xl border border-black/15 px-5 py-2.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Download video
                </a>
              )}
            </div>
          )}
          {render.state === "error" && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{render.message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
