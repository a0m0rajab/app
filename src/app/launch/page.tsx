"use client";

import { useMemo, useRef, useState } from "react";
import { ProductStep } from "@/components/launch/product-step";
import { PreviewStep, soundKey, type Sound } from "@/components/launch/preview-step";
import { SAMPLE_PRODUCT, type LaunchOptions, type Shot } from "@/components/launch/options";
import { SAMPLE_STORYBOARD, type Feature, type Storyboard } from "@/remotion/types";

export default function LaunchPage() {
  const [step, setStep] = useState<"product" | "preview">("product");
  const [productName, setProductName] = useState(SAMPLE_PRODUCT.productName);
  const [description, setDescription] = useState(SAMPLE_PRODUCT.description);
  const [shots, setShots] = useState<Shot[]>([]);
  const [options, setOptions] = useState<LaunchOptions>({
    seconds: 30,
    format: "landscape",
    tone: "punchy",
    brandColor: SAMPLE_PRODUCT.brandColor,
  });
  const [base, setBase] = useState<Storyboard>(SAMPLE_STORYBOARD);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [sound, setSound] = useState<Sound>({ state: "idle" });
  const [mix, setMix] = useState({ voiceover: true, music: true });
  const soundRequest = useRef(0);

  // Name and colour stay live so tweaks show up in the preview instantly.
  const storyboard = useMemo<Storyboard>(
    () => ({ ...base, productName: productName.trim() || base.productName, brandColor: options.brandColor }),
    [base, productName, options.brandColor],
  );

  const audio = useMemo(
    () =>
      sound.state === "ready" ? { voiceover: mix.voiceover ? sound.voiceover : undefined, music: mix.music ? sound.music : undefined } : undefined,
    [sound, mix],
  );

  // Gemini TTS reads a narration written for this cut while Lyria scores the music bed.
  async function generateSound(board: Storyboard, seconds: number) {
    const request = ++soundRequest.current;
    setSound((prev) => {
      revokeSound(prev);
      return { state: "generating" };
    });
    try {
      const res = await fetch("/api/launch/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Screenshots are only needed for the picture, so keep the request small.
        body: JSON.stringify({ storyboard: { ...board, features: board.features.map((f) => ({ ...f, screenshot: undefined })) }, seconds, tone: options.tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (request !== soundRequest.current) return;
      setSound({
        state: "ready",
        voiceover: data.voiceover && toObjectUrl(data.voiceover),
        music: data.music && toObjectUrl(data.music),
        script: data.script,
        warning: data.errors?.join(" "),
        key: soundKey(board, seconds),
      });
    } catch (err) {
      if (request === soundRequest.current) setSound({ state: "error", message: (err as Error).message });
    }
  }

  async function generate() {
    if (!productName.trim() || !description.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          description,
          tone: options.tone,
          brandColor: options.brandColor,
          screenshots: shots.map((s) => s.url),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const generated = data.storyboard as Storyboard;
      setBase({ ...generated, features: generated.features.map((f, i) => ({ ...f, screenshot: shots[i]?.url })) });
      setStep("preview");
      generateSound(generated, options.seconds);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function updateFeature(index: number, patch: Partial<Feature>) {
    setBase((s) => ({ ...s, features: s.features.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));
  }

  return (
    <main className="flex-1 overflow-y-auto bg-white font-display text-ink">
      {step === "product" ? (
        <ProductStep
          productName={productName}
          description={description}
          shots={shots}
          options={options}
          generating={generating}
          error={error}
          onProductName={setProductName}
          onDescription={setDescription}
          onShots={setShots}
          onOptions={(patch) => setOptions((o) => ({ ...o, ...patch }))}
          onSubmit={generate}
        />
      ) : (
        <PreviewStep
          storyboard={storyboard}
          options={options}
          error={error}
          generating={generating}
          onOptions={(patch) => setOptions((o) => ({ ...o, ...patch }))}
          onUpdate={(patch) => setBase((s) => ({ ...s, ...patch }))}
          onUpdateFeature={updateFeature}
          onRegenerate={generate}
          audio={audio}
          sound={sound}
          mix={mix}
          onMix={(patch) => setMix((m) => ({ ...m, ...patch }))}
          onGenerateSound={() => generateSound(storyboard, options.seconds)}
          onBack={() => setStep("product")}
        />
      )}
    </main>
  );
}

function toObjectUrl({ data, mimeType }: { data: string; mimeType: string }) {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function revokeSound(sound: Sound) {
  if (sound.state !== "ready") return;
  if (sound.voiceover) URL.revokeObjectURL(sound.voiceover);
  if (sound.music) URL.revokeObjectURL(sound.music);
}
