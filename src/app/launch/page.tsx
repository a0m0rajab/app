"use client";

import { useMemo, useState } from "react";
import { ProductStep } from "@/components/launch/product-step";
import { PreviewStep } from "@/components/launch/preview-step";
import type { LaunchOptions, Shot } from "@/components/launch/options";
import { SAMPLE_STORYBOARD, type Feature, type Storyboard } from "@/remotion/types";

export default function LaunchPage() {
  const [step, setStep] = useState<"product" | "preview">("product");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [options, setOptions] = useState<LaunchOptions>({
    seconds: 30,
    format: "landscape",
    tone: "punchy",
    brandColor: SAMPLE_STORYBOARD.brandColor,
  });
  const [base, setBase] = useState<Storyboard>(SAMPLE_STORYBOARD);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Name and colour stay live so tweaks show up in the preview instantly.
  const storyboard = useMemo<Storyboard>(
    () => ({ ...base, productName: productName.trim() || base.productName, brandColor: options.brandColor }),
    [base, productName, options.brandColor],
  );

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
          onBack={() => setStep("product")}
        />
      )}
    </main>
  );
}
