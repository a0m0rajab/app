import { Type, type Schema } from "@google/genai";
import { ai } from "@/lib/gemini";
import type { Storyboard } from "@/remotion/types";

const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

const str = (description: string): Schema => ({ type: Type.STRING, description });

const storyboardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tagline: str("Punchy one-sentence value proposition, max 12 words"),
    problem: str("A relatable pain point phrased as a question, max 14 words"),
    navItems: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: "5", maxItems: "5", description: "Sidebar nav labels for the app, 1-2 words each" },
    features: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
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
};

type LaunchRequest = {
  productName: string;
  description: string;
  audience?: string;
  brandColor?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LaunchRequest;
  const productName = body.productName?.trim();
  const description = body.description?.trim();
  if (!productName || !description) {
    return Response.json({ error: "Product name and description are required" }, { status: 400 });
  }

  const prompt = `You are a product marketer writing a 20-second SaaS launch video.
Product name: ${productName}
What it does: ${description}
${body.audience?.trim() ? `Target audience: ${body.audience.trim()}` : ""}

Write concise, energetic copy and design three mock app screens that showcase the product's key features with realistic, specific data.`;

  try {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: storyboardSchema },
    });
    const generated = JSON.parse(res.text ?? "{}") as Omit<Storyboard, "productName" | "brandColor">;

    const storyboard: Storyboard = {
      ...generated,
      productName,
      brandColor: /^#[0-9a-f]{6}$/i.test(body.brandColor ?? "") ? body.brandColor! : "#6366f1",
      navItems: generated.navItems.slice(0, 5),
      stats: generated.stats.slice(0, 3),
      features: generated.features.slice(0, 3).map((f) => ({
        ...f,
        screen: { ...f.screen, metrics: f.screen.metrics.slice(0, 3), chart: f.screen.chart.slice(0, 7), rows: f.screen.rows.slice(0, 4) },
      })),
    };
    return Response.json({ storyboard });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
