import { GenerateVideosOperation, PersonGeneration, VideoGenerationReferenceType } from "@google/genai";
import { ai, isOperationName, VIDEO_MODELS } from "@/lib/gemini";

type StartRequest = {
  prompt: string;
  model?: (typeof VIDEO_MODELS)[number];
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p" | "4k";
  durationSeconds?: 4 | 6 | 8;
  negativePrompt?: string;
  image?: { data: string; mimeType: string };
  // Up to 3 "asset" images (people, products, places) to keep consistent in the clip. Veo 3.1 / 3.1 Fast only.
  referenceImages?: { data: string; mimeType: string }[];
};

const REFERENCE_MODELS: readonly string[] = ["veo-3.1-generate-preview", "veo-3.1-fast-generate-preview"];

// Start a Veo generation job. Returns the operation name to poll.
export async function POST(request: Request) {
  const body = (await request.json()) as StartRequest;
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

  const model = VIDEO_MODELS.includes(body.model!) ? body.model! : VIDEO_MODELS[0];

  const references = (body.referenceImages ?? []).slice(0, 3);
  if (references.length && !REFERENCE_MODELS.includes(model)) {
    return Response.json({ error: "Reference images need Veo 3.1 or Veo 3.1 Fast" }, { status: 400 });
  }

  // Veo rejects negativePrompt alongside reference images, so fold it into the prompt there.
  const negativePrompt = body.negativePrompt?.trim() || undefined;
  const fullPrompt = references.length && negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}.` : prompt;

  try {
    const operation = await ai.models.generateVideos({
      model,
      prompt: fullPrompt,
      // Veo doesn't accept a starting frame alongside reference images.
      image: body.image && !references.length ? { imageBytes: body.image.data, mimeType: body.image.mimeType } : undefined,
      config: {
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        negativePrompt: references.length ? undefined : negativePrompt,
        ...(references.length
          ? {
              durationSeconds: 8,
              personGeneration: PersonGeneration.ALLOW_ADULT,
              referenceImages: references.map((r) => ({
                image: { imageBytes: r.data, mimeType: r.mimeType },
                referenceType: VideoGenerationReferenceType.ASSET,
              })),
            }
          : { durationSeconds: body.durationSeconds }),
      },
    });
    return Response.json({ name: operation.name });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

// Poll a generation job.
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name");
  if (!isOperationName(name)) return Response.json({ error: "Invalid operation name" }, { status: 400 });

  try {
    const operation = new GenerateVideosOperation();
    operation.name = name;
    const result = await ai.operations.getVideosOperation({ operation });

    if (!result.done) return Response.json({ done: false });
    if (result.error) return Response.json({ done: true, error: result.error.message ?? "Generation failed" });

    const videos = result.response?.generatedVideos ?? [];
    if (videos.length === 0) {
      const reasons = result.response?.raiMediaFilteredReasons?.join(" ");
      return Response.json({ done: true, error: reasons || "No video was returned (it may have been filtered)." });
    }

    return Response.json({
      done: true,
      videos: videos.map((_, i) => `/api/video/download?name=${encodeURIComponent(name)}&i=${i}`),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
