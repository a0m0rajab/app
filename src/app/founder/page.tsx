"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, ChipGroup, DownloadIcon, ErrorNote, Eyebrow, PrimaryButton } from "@/components/launch/ui";
import type { Shot } from "@/components/launch/options";
import { readImage } from "@/components/launch/read-image";

const SLOTS = [
  { key: "founder", label: "You", hint: "A clear, front-facing photo", required: true },
  { key: "product", label: "Your product", hint: "Screenshot, device or logo", required: false },
  { key: "place", label: "Your space", hint: "Office, studio or brand look", required: false },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

const SHOTS = {
  selfie: { label: "Selfie vlog", text: "handheld selfie-style vlog shot, the founder holding the phone at arm's length" },
  interview: { label: "Interview", text: "seated interview shot on a tripod, framed from the chest up, slightly off-centre" },
  podcast: { label: "Podcast", text: "podcast-style shot, the founder speaking into a studio microphone" },
} as const;

const SETTINGS = {
  office: { label: "Office", text: "in a bright, modern startup office with plants and laptops in the soft-focus background" },
  cafe: { label: "Café", text: "in a cosy café with warm window light and gentle background chatter" },
  outdoors: { label: "Outdoors", text: "walking down a sunny city street, golden hour light" },
  studio: { label: "Studio", text: "in a clean studio with a soft seamless backdrop and professional lighting" },
} as const;

const MODELS = [
  { value: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast" },
  { value: "veo-3.1-generate-preview", label: "Veo 3.1" },
] as const;

type ShotStyle = keyof typeof SHOTS;
type Setting = keyof typeof SETTINGS;

type Status =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "generating"; name: string; startedAt: number }
  | { state: "done"; video: string }
  | { state: "error"; message: string };

const POLL_MS = 10_000;
const TARGET_WORDS = 20;

const field =
  "w-full rounded-[10px] border border-edge bg-white px-4 text-base text-ink outline-none transition-shadow placeholder:text-dash focus:border-ink focus:shadow-[0_0_0_0.5px_#0E0E0E]";

export default function FounderPage() {
  const [founder, setFounder] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [line, setLine] = useState("");
  const [refs, setRefs] = useState<Partial<Record<SlotKey, Shot>>>({});
  const [shot, setShot] = useState<ShotStyle>("selfie");
  const [setting, setSetting] = useState<Setting>("office");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [model, setModel] = useState<(typeof MODELS)[number]["value"]>(MODELS[0].value);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [scriptError, setScriptError] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const resultRef = useRef<HTMLDivElement>(null);

  const busy = status.state === "starting" || status.state === "generating";
  const words = line.trim() ? line.trim().split(/\s+/).length : 0;
  const prompt = customPrompt ?? buildPrompt();
  const ready = !!refs.founder && !!line.trim() && !!productName.trim();

  function buildPrompt() {
    const who = founder.trim() ? `${founder.trim()}, the founder of ${productName.trim() || "the product"}` : "the founder";
    return [
      `A ${SHOTS[shot].text}, ${SETTINGS[setting].text}.`,
      `The person is ${who}, exactly as shown in the reference photo.`,
      refs.product && `The product from the reference image is visible in the scene, held up or on a nearby screen.`,
      refs.place && `The look and surroundings match the reference image of the space.`,
      line.trim() && `Looking into the camera, they say warmly and confidently: "${line.trim()}"`,
      "Authentic, natural lighting, shallow depth of field, real-world audio. No subtitles, captions or on-screen text.",
    ]
      .filter(Boolean)
      .join(" ");
  }

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
        else if (data.done) setStatus({ state: "done", video: data.videos[0] });
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

  async function addRef(key: SlotKey, file?: File) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
    const image = await readImage(file);
    setRefs((r) => ({ ...r, [key]: image }));
  }

  async function writeLine() {
    setWriting(true);
    setScriptError("");
    try {
      const res = await fetch("/api/founder/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founder, productName, description, shot: SHOTS[shot].label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLine(data.line);
    } catch (err) {
      setScriptError((err as Error).message);
    } finally {
      setWriting(false);
    }
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setStatus({ state: "starting" });
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const referenceImages = SLOTS.flatMap(({ key }) => {
        const url = refs[key]?.url;
        return url ? [{ data: url.split(",")[1], mimeType: "image/jpeg" }] : [];
      });
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, aspectRatio, resolution, referenceImages, negativePrompt: "subtitles, captions, text overlays, watermark, distorted face" }),
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

  const elapsed = status.state === "generating" ? Math.floor((now - status.startedAt) / 1000) : 0;

  return (
    <main className="flex-1 overflow-y-auto bg-white font-display text-ink">
      <form onSubmit={generate} className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 pt-10 pb-14 sm:px-14 lg:flex-row lg:gap-18 lg:pt-16">
        <div className="flex shrink-0 flex-col gap-10 lg:w-110">
          <div className="flex flex-col gap-5">
            <Eyebrow muted>Founder video · Veo 3.1</Eyebrow>
            <h1 className="text-5xl/12 font-extrabold tracking-[-0.04em] sm:text-7xl/18">
              People buy from{" "}
              <span className="relative inline-block">
                <span className="absolute inset-x-[-6px] top-[52%] h-[42%] -rotate-[1.5deg] rounded bg-sun" aria-hidden />
                <span className="relative">people.</span>
              </span>
            </h1>
            <p className="text-[17px]/6.5 text-body">
              Add a photo of yourself and your product. Veo turns it into an 8-second clip of you pitching it on camera, in your own words,
              with real voice and sound.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-[13px]/4 font-semibold">Your name &amp; role</span>
              <input value={founder} onChange={(e) => setFounder(e.target.value)} placeholder="Alex Rivera, Founder" className={`${field} h-12`} />
            </label>
            <div className="grid grid-cols-[2fr_3fr] gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[13px]/4 font-semibold">Product</span>
                <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ledgerly" className={`${field} h-12`} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[13px]/4 font-semibold">What it does</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Invoicing for freelancers"
                  className={`${field} h-12`}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between text-[13px]/4">
                <span className="font-semibold">What you say</span>
                <span className={`font-mono tabular-nums ${words > TARGET_WORDS + 4 ? "text-red-600" : "text-muted"}`}>
                  {words}/{TARGET_WORDS} words
                </span>
              </span>
              <textarea
                value={line}
                onChange={(e) => setLine(e.target.value)}
                rows={3}
                placeholder="Hi, I'm Alex. I built Ledgerly because chasing invoices was eating my weekends — now it takes me two minutes."
                className={`${field} min-h-24 resize-y py-3.5 leading-6`}
              />
            </label>
            <div className="flex items-center gap-4 text-sm/4.5">
              <button
                type="button"
                onClick={writeLine}
                disabled={writing || !productName.trim() || !description.trim()}
                className="font-semibold underline underline-offset-3 hover:text-muted disabled:no-underline disabled:opacity-40"
              >
                {writing ? "Writing…" : line ? "Rewrite it for me" : "Write it for me"}
              </button>
              <span className="text-muted">About 8 seconds spoken</span>
            </div>
            {scriptError && <ErrorNote>{scriptError}</ErrorNote>}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div ref={resultRef}>
            {status.state !== "idle" && status.state !== "error" && (
              <div className="flex flex-col gap-4 rounded-2xl bg-ink p-4 text-white sm:p-6">
                {status.state === "done" ? (
                  <>
                    <video
                      src={status.video}
                      controls
                      autoPlay
                      loop
                      className="max-h-[60vh] w-full rounded-[10px] bg-black object-contain"
                      style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[13px]/4 font-semibold">
                        {aspectRatio} · {resolution} · 8s with audio
                      </span>
                      <div className="flex gap-2.5">
                        <a
                          href={status.video}
                          download={`${(productName || "founder").toLowerCase().replace(/\W+/g, "-")}-founder.mp4`}
                          className="flex h-11 items-center gap-2 rounded-xl bg-sun px-4 text-[15px] font-extrabold text-ink hover:brightness-95"
                        >
                          <DownloadIcon />
                          Download MP4
                        </a>
                        <button type="submit" className="h-11 rounded-xl border border-white/25 px-4 text-[15px] font-semibold hover:border-white">
                          New take
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-5 py-6">
                    <span className="text-xs/4 font-semibold tracking-[0.14em] text-sun uppercase">
                      {status.state === "starting" ? "Sending to Veo…" : "Rolling camera"}
                    </span>
                    <p className="max-w-lg text-3xl/9 font-extrabold tracking-[-0.03em]">&ldquo;{line.trim()}&rdquo;</p>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[13px]/4 tabular-nums">
                        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-xs bg-white/20">
                        <div className="h-full rounded-xs bg-sun transition-[width] duration-1000" style={{ width: `${Math.min(95, (elapsed / 180) * 100)}%` }} />
                      </div>
                      <span className="text-[13px]/4 text-dash">usually 1–4 min</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <Eyebrow>Reference images · {Object.keys(refs).length} of 3</Eyebrow>
              <span className="text-[13px]/4 text-muted">Veo keeps these looking the same in the clip</span>
            </div>
            <div className="grid grid-cols-3 gap-3.5">
              {SLOTS.map((slot) => {
                const image = refs[slot.key];
                return (
                  <div key={slot.key} className="flex min-w-0 flex-col gap-2">
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        addRef(slot.key, e.dataTransfer.files[0]);
                      }}
                      className={`group relative flex h-44 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[10px] px-3 text-center transition-colors ${
                        image
                          ? slot.required
                            ? "border-[1.5px] border-ink"
                            : "border border-line"
                          : "border-2 border-dashed border-dash bg-paper hover:border-muted"
                      }`}
                    >
                      {image ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                          <img src={image.url} alt="" className="absolute inset-0 size-full object-cover" />
                          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold opacity-0 shadow transition-opacity group-hover:opacity-100">
                            Replace
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-xl leading-none text-sun">+</span>
                          <span className="text-[13px]/4 text-muted">{slot.hint}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          addRef(slot.key, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px]/4 font-semibold">
                        {slot.label}
                        {slot.required ? "" : <span className="font-normal text-muted"> · optional</span>}
                      </span>
                      {image && (
                        <button
                          type="button"
                          onClick={() =>
                            setRefs((r) => {
                              const next = { ...r };
                              delete next[slot.key];
                              return next;
                            })
                          }
                          className="shrink-0 text-[13px]/4 text-muted hover:text-ink"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-6 border-t border-line pt-6">
            <ChipGroup
              label="Shot"
              options={(Object.keys(SHOTS) as ShotStyle[]).map((k) => ({ value: k, label: SHOTS[k].label }))}
              value={shot}
              onChange={setShot}
            />
            <ChipGroup
              label="Setting"
              options={(Object.keys(SETTINGS) as Setting[]).map((k) => ({ value: k, label: SETTINGS[k].label }))}
              value={setting}
              onChange={setSetting}
            />
            <ChipGroup
              label="Format"
              options={[
                { value: "9:16", label: "9:16" },
                { value: "16:9", label: "16:9" },
              ]}
              value={aspectRatio}
              onChange={setAspectRatio}
            />
            <ChipGroup
              label="Quality"
              options={[
                { value: "720p", label: "720p" },
                { value: "1080p", label: "1080p" },
              ]}
              value={resolution}
              onChange={setResolution}
            />
            <ChipGroup label="Model" options={MODELS} value={model} onChange={setModel} />
          </div>

          <details className="group border-t border-line pt-5" open={customPrompt !== null}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <Eyebrow muted>Director&apos;s prompt {customPrompt !== null && "· edited"}</Eyebrow>
              <span className="text-[13px]/4 text-muted group-open:hidden">Show what we send to Veo</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2">
              <textarea value={prompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={5} className={`${field} resize-y py-3 text-sm/5.5`} />
              {customPrompt !== null && (
                <button type="button" onClick={() => setCustomPrompt(null)} className="self-start text-[13px]/4 font-semibold underline underline-offset-3">
                  Reset to automatic
                </button>
              )}
            </div>
          </details>

          {status.state === "error" && <ErrorNote>{status.message}</ErrorNote>}

          <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <Eyebrow muted>You&apos;ll get</Eyebrow>
              <div className="flex items-baseline gap-3.5">
                <span className="text-[28px]/8 font-extrabold tracking-[-0.03em]">0:08</span>
                <span className="text-[15px]/5 text-body">
                  {aspectRatio} · {resolution} · you on camera, with voice
                </span>
              </div>
            </div>
            <PrimaryButton type="submit" disabled={!ready || busy}>
              {busy ? "Rolling…" : !refs.founder ? "Add your photo first" : "Generate founder video"}
              <ArrowRight />
            </PrimaryButton>
          </div>
        </div>
      </form>
    </main>
  );
}
