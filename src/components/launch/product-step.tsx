"use client";

import { type DragEvent, type FormEvent, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ChipGroup, ErrorNote, Eyebrow, PrimaryButton } from "./ui";
import { FORMATS, LENGTHS, MAX_SHOTS, TONES, type Format, type LaunchOptions, type Shot } from "./options";

const field =
  "w-full rounded-[10px] border border-edge bg-white px-4 text-base text-ink outline-none transition-shadow placeholder:text-dash focus:border-ink focus:shadow-[0_0_0_0.5px_#0E0E0E]";

// Downscale so screenshots stay light enough to send to Gemini and render into video.
async function readShot(file: File): Promise<Shot> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { id: crypto.randomUUID(), name: file.name, url: canvas.toDataURL("image/jpeg", 0.9) };
}

type Props = {
  productName: string;
  description: string;
  shots: Shot[];
  options: LaunchOptions;
  generating: boolean;
  error: string;
  onProductName: (value: string) => void;
  onDescription: (value: string) => void;
  onShots: (shots: Shot[]) => void;
  onOptions: (patch: Partial<LaunchOptions>) => void;
  onSubmit: () => void;
};

export function ProductStep(p: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const ready = p.productName.trim() && p.description.trim();
  const full = p.shots.length >= MAX_SHOTS;

  async function addFiles(files: FileList | null) {
    const images = Array.from(files ?? []).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
    const added = await Promise.all(images.slice(0, MAX_SHOTS - p.shots.length).map(readShot));
    p.onShots([...p.shots, ...added]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function moveShot(to: number) {
    if (dragIndex === null || dragIndex === to) return;
    const next = [...p.shots];
    next.splice(to, 0, next.splice(dragIndex, 1)[0]);
    p.onShots(next);
    setDragIndex(to);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (ready && !p.generating) p.onSubmit();
  }

  const scenes = p.shots.length || 3;

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 pt-10 pb-14 sm:px-14 lg:flex-row lg:gap-18 lg:pt-16"
    >
      <div className="flex shrink-0 flex-col gap-10 lg:w-110">
        <div className="flex flex-col gap-5">
          <Eyebrow muted>Step 1 of 2 — Your product</Eyebrow>
          <h1 className="text-5xl/12 font-extrabold tracking-[-0.04em] sm:text-7xl/18">Screenshots in. Launch video out.</h1>
          <p className="text-[17px]/6.5 text-body">
            Drop a few shots of your SaaS. We&apos;ll write the script, cut the scenes and animate it — ready to post in about two
            minutes.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[13px]/4 font-semibold">Product name</span>
            <input
              value={p.productName}
              onChange={(e) => p.onProductName(e.target.value)}
              placeholder="Ledgerly"
              className={`${field} h-12`}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px]/4 font-semibold">What does it do?</span>
            <textarea
              value={p.description}
              onChange={(e) => p.onDescription(e.target.value)}
              rows={2}
              placeholder="Invoicing and expense tracking for freelancers who hate spreadsheets."
              className={`${field} min-h-19 resize-y py-3.5 leading-6`}
            />
          </label>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <button
          type="button"
          disabled={full}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex h-55 shrink-0 flex-col items-center justify-center gap-3.5 rounded-2xl border-2 border-dashed px-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            dragging ? "border-ink bg-sun-soft/40" : "border-dash bg-paper hover:border-muted"
          }`}
        >
          <span className="flex size-13 items-center justify-center rounded-full bg-ink text-sun">
            <ArrowUp />
          </span>
          <span className="text-xl/6 font-bold tracking-[-0.01em]">
            {full ? "That's a full reel" : "Drop product screenshots here"}
          </span>
          <span className="text-sm/4.5 text-muted">
            or <span className="underline underline-offset-2">browse files</span> · PNG, JPG or WebP · up to {MAX_SHOTS} images
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />

        {p.shots.length > 0 && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <Eyebrow>
                Uploaded · {p.shots.length} {p.shots.length === 1 ? "image" : "images"}
              </Eyebrow>
              <span className="text-[13px]/4 text-muted">Drag to set scene order</span>
            </div>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {p.shots.map((shot, i) => (
                <div
                  key={shot.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnter={() => moveShot(i)}
                  onDragOver={(e) => dragIndex !== null && e.preventDefault()}
                  onDragEnd={() => setDragIndex(null)}
                  className={`group flex min-w-0 cursor-grab flex-col gap-2 active:cursor-grabbing ${dragIndex === i ? "opacity-40" : ""}`}
                >
                  <div className="relative h-33 overflow-hidden rounded-[10px] border border-line bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                    <img src={shot.url} alt="" className="size-full object-cover object-top" draggable={false} />
                    <span className="absolute right-2 bottom-2 flex size-5 items-center justify-center rounded-full bg-ink font-mono text-[11px]/3.5 font-semibold text-sun">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => p.onShots(p.shots.filter((s) => s.id !== shot.id))}
                      aria-label={`Remove ${shot.name}`}
                      className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-white text-sm font-bold opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                  <span className="truncate text-[13px]/4 font-medium">{shot.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-10 gap-y-6 border-t border-line pt-6">
          <ChipGroup
            label="Length"
            options={LENGTHS.map((s) => ({ value: s, label: `${s}s` }))}
            value={p.options.seconds}
            onChange={(seconds) => p.onOptions({ seconds })}
          />
          <ChipGroup
            label="Format"
            options={(Object.keys(FORMATS) as Format[]).map((f) => ({ value: f, label: FORMATS[f].label }))}
            value={p.options.format}
            onChange={(format) => p.onOptions({ format })}
          />
          <ChipGroup
            label="Tone"
            options={TONES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
            value={p.options.tone}
            onChange={(tone) => p.onOptions({ tone })}
          />
          <div className="flex flex-col gap-2.5">
            <Eyebrow muted>Brand</Eyebrow>
            <label className="flex h-9.5 cursor-pointer items-center gap-2 rounded-full border border-edge pr-3.5 pl-1.5 text-sm/4.5 font-semibold hover:border-ink">
              <input
                type="color"
                value={p.options.brandColor}
                onChange={(e) => p.onOptions({ brandColor: e.target.value })}
                className="size-6.5 cursor-pointer rounded-full [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
              />
              <span className="font-mono text-[13px] uppercase">{p.options.brandColor}</span>
            </label>
          </div>
        </div>

        {p.error && <ErrorNote>{p.error}</ErrorNote>}

        <div className="flex flex-1 flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-end">
          <span className="text-sm/4.5 text-body sm:pb-5">
            {p.shots.length
              ? `${scenes} ${scenes === 1 ? "scene" : "scenes"} ready · you can edit every line next`
              : "No screenshots? We'll mock up 3 screens from your description."}
          </span>
          <PrimaryButton type="submit" disabled={!ready || p.generating}>
            {p.generating ? "Writing your script…" : "Generate video"}
            <ArrowRight />
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
