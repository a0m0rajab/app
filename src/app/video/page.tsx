"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const MODELS = [
  { id: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast" },
  { id: "veo-3.1-generate-preview", label: "Veo 3.1" },
  { id: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite" },
];

type Status =
  | { state: "idle" }
  | { state: "generating"; name: string; startedAt: number }
  | { state: "done"; videos: string[] }
  | { state: "error"; message: string };

const POLL_MS = 10_000;

export default function VideoPage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "4k">("720p");
  const [duration, setDuration] = useState<4 | 6 | 8>(8);
  const [image, setImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [now, setNow] = useState(() => Date.now());

  const generating = status.state === "generating";
  // 1080p and 4k only support 8 second clips.
  const durationLocked = resolution !== "720p";

  useEffect(() => {
    if (status.state !== "generating") return;
    const name = status.name;
    let cancelled = false;

    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/video?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) setStatus({ state: "error", message: data.error });
        else if (data.done) setStatus({ state: "done", videos: data.videos });
      } catch (err) {
        if (!cancelled) setStatus({ state: "error", message: (err as Error).message });
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [status]);

  function onImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setImage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImage({ data: url.split(",")[1], mimeType: file.type, preview: url });
    };
    reader.readAsDataURL(file);
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || generating) return;

    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          model,
          aspectRatio,
          resolution,
          durationSeconds: durationLocked ? 8 : duration,
          image: image && { data: image.data, mimeType: image.mimeType },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const startedAt = Date.now();
      setNow(startedAt);
      setStatus({ state: "generating", name: data.name, startedAt });
    } catch (err) {
      setStatus({ state: "error", message: (err as Error).message });
    }
  }

  const field = "rounded-xl border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-blue-500 dark:border-white/20";
  const label = "flex flex-col gap-1.5 text-sm";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
      <form onSubmit={generate} className="space-y-4">
        <label className={label}>
          <span className="font-medium">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="A drone shot gliding over a misty pine forest at sunrise, birds calling softly…"
            className={`${field} resize-y leading-relaxed`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={label}>
            <span className="opacity-70">Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} className={field}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            <span className="opacity-70">Aspect ratio</span>
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as "16:9" | "9:16")} className={field}>
              <option value="16:9">16:9 landscape</option>
              <option value="9:16">9:16 portrait</option>
            </select>
          </label>
          <label className={label}>
            <span className="opacity-70">Resolution</span>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as "720p" | "1080p" | "4k")} className={field}>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </label>
          <label className={label}>
            <span className="opacity-70">Duration</span>
            <select
              value={durationLocked ? 8 : duration}
              onChange={(e) => setDuration(Number(e.target.value) as 4 | 6 | 8)}
              disabled={durationLocked}
              className={`${field} disabled:opacity-50`}
            >
              <option value={4}>4 seconds</option>
              <option value={6}>6 seconds</option>
              <option value={8}>8 seconds</option>
            </select>
          </label>
        </div>

        <label className={label}>
          <span className="opacity-70">Negative prompt (optional)</span>
          <input
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="cartoon, low quality, text overlays"
            className={field}
          />
        </label>

        <div className={label}>
          <span className="opacity-70">Starting frame (optional)</span>
          <div className="flex items-center gap-3">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onImageChange} className="text-sm" />
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.preview} alt="Starting frame" className="h-14 rounded-lg object-cover" />
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={generating || !prompt.trim()}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {generating ? "Generating…" : "Generate video"}
        </button>
      </form>

      <section className="mt-8">
        {status.state === "generating" && (
          <div className="rounded-xl bg-black/5 p-6 text-center dark:bg-white/10">
            <p className="animate-pulse font-medium">Generating your video…</p>
            <p className="mt-1 text-sm opacity-60">
              {Math.floor((now - status.startedAt) / 1000)}s elapsed. This usually takes 1–6 minutes.
            </p>
          </div>
        )}
        {status.state === "error" && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {status.message}
          </div>
        )}
        {status.state === "done" &&
          status.videos.map((src) => (
            <div key={src} className="space-y-2">
              <video src={src} controls autoPlay loop className="w-full rounded-xl bg-black" />
              <a href={src} download="veo.mp4" className="inline-block text-sm text-blue-600 hover:underline">
                Download MP4
              </a>
            </div>
          ))}
      </section>
    </main>
  );
}
