import { Type, type Part, type Schema } from "@google/genai";
import { ai } from "@/lib/gemini";
import type { Storyboard } from "@/remotion/types";

const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

const str = (description: string): Schema => ({ type: Type.STRING, description });

const storyboardSchema = (sceneCount: number): Schema => ({
  type: Type.OBJECT,
  properties: {
    tagline: str("Punchy one-sentence value proposition, max 12 words"),
    problem: str("A relatable pain point phrased as a question, max 14 words"),
    navItems: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: "5", maxItems: "5", description: "Sidebar nav labels for the app, 1-2 words each" },
    features: {
      type: Type.ARRAY,
      minItems: String(sceneCount),
      maxItems: String(sceneCount),
      items: {
        type: Type.OBJECT,
        properties: {
          title: str("Benefit-led feature headline, max 6 words"),
          description: str("One sentence, max 14 words"),
          screen: {
            type: Type.OBJECT,
            description: "Realistic mock app screen that demonstrates this feature",
            properties: {
              kind: { type: Type.STRING, enum: ["chart", "table", "board"], description: "Use a different kind for each feature" },
              title: str("Page heading inside the app"),
              metrics: {
                type: Type.ARRAY,
                minItems: "3",
                maxItems: "3",
                items: {
                  type: Type.OBJECT,
                  properties: { label: str("Short metric label"), value: str("Short value like 24, 92% or $4.2k") },
                  required: ["label", "value"],
                },
              },
              chart: { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: "7", maxItems: "7", description: "7 values 0-100 trending upward (only meaningful for chart)" },
              rows: {
                type: Type.ARRAY,
                minItems: "4",
                maxItems: "4",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: str("Realistic item name"),
                    meta: str("Short secondary info like a date, owner or category"),
                    status: str("Short status. For board, use exactly 3 distinct column names across rows."),
                  },
                  required: ["title", "meta", "status"],
                },
              },
            },
            required: ["kind", "title", "metrics", "chart", "rows"],
          },
        },
        required: ["title", "description", "screen"],
      },
    },
    stats: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
      items: {
        type: Type.OBJECT,
        properties: { value: str("Impressive but plausible number like 10x, 5,000+ or 99.9%"), label: str("Short lowercase label") },
        required: ["value", "label"],
      },
    },
    cta: str("Call to action, max 7 words"),
    url: str("Plausible product domain without https://"),
  },
  required: ["tagline", "problem", "navItems", "features", "stats", "cta", "url"],
});

export const TONES = {
  punchy: "Short, bold, high-energy lines.",
  calm: "Warm, reassuring and unhurried.",
  playful: "Witty and light-hearted, with a wink of humour.",
} as const;

export type Tone = keyof typeof TONES;

export const toTone = (tone?: string): Tone => (tone && Object.hasOwn(TONES, tone) ? (tone as Tone) : "punchy");

export const MAX_SCENES = 6;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/;

export type LaunchRequest = {
  productName: string;
  description: string;
  audience?: string;
  brandColor?: string;
  tone?: string;
  // Screenshot data URLs, in scene order. Each one becomes a feature scene.
  screenshots?: string[];
};

export async function generateStoryboard(req: LaunchRequest): Promise<Storyboard> {
  const productName = req.productName.trim();
  const images = (req.screenshots ?? []).slice(0, MAX_SCENES).flatMap((url): Part[] => {
    const match = DATA_URL.exec(url);
    return match ? [{ inlineData: { mimeType: match[1], data: match[2] } }] : [];
  });
  const sceneCount = images.length || 3;

  const prompt = `You are a product marketer writing a short SaaS launch video.
Product name: ${productName}
What it does: ${req.description.trim()}
${req.audience?.trim() ? `Target audience: ${req.audience.trim()}` : ""}
Tone: ${TONES[toTone(req.tone)]}

Write concise copy and design ${sceneCount} mock app screens that showcase the product's key features with realistic, specific data.
${images.length ? `The ${images.length} attached screenshots are the real product, in scene order. Feature N must describe what screenshot N shows.` : ""}`;

  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }, ...images] }],
    config: { responseMimeType: "application/json", responseSchema: storyboardSchema(sceneCount) },
  });
  const generated = JSON.parse(res.text ?? "{}") as Omit<Storyboard, "productName" | "brandColor">;

  return {
    ...generated,
    productName,
    brandColor: /^#[0-9a-f]{6}$/i.test(req.brandColor ?? "") ? req.brandColor! : "#6366f1",
    navItems: generated.navItems.slice(0, 5),
    stats: generated.stats.slice(0, 3),
    features: generated.features.slice(0, sceneCount).map((f) => ({
      ...f,
      screen: { ...f.screen, metrics: f.screen.metrics.slice(0, 3), chart: f.screen.chart.slice(0, 7), rows: f.screen.rows.slice(0, 4) },
    })),
  };
}
