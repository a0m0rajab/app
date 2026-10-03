import { GenerateVideosOperation, PersonGeneration, VideoGenerationReferenceType } from "@google/genai";
import { ai, VIDEO_MODELS } from "@/lib/gemini";

export type StartRequest = {
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

export class VideoRequestError extends Error {}

// Start a Veo generation job. Returns the operation name to poll.
export async function startVideo(body: StartRequest) {
  const prompt = body.prompt.trim();
  const model = VIDEO_MODELS.includes(body.model!) ? body.model! : VIDEO_MODELS[0];

  const references = (body.referenceImages ?? []).slice(0, 3);
  if (references.length && !REFERENCE_MODELS.includes(model)) throw new VideoRequestError("Reference images need Veo 3.1 or Veo 3.1 Fast");

  // Veo rejects negativePrompt alongside reference images, so fold it into the prompt there.
  const negativePrompt = body.negativePrompt?.trim() || undefined;
  const fullPrompt = references.length && negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}.` : prompt;

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
  if (!operation.name) throw new Error("Veo did not return an operation");
  return operation.name;
}

export type VideoStatus = { done: false } | { done: true; error: string } | { done: true; videos: string[] };

// Poll a generation job. Video links point at our download proxy so the API key stays on the server.
export async function getVideoStatus(name: string): Promise<VideoStatus> {
  const operation = new GenerateVideosOperation();
  operation.name = name;
  const result = await ai.operations.getVideosOperation({ operation });

  if (!result.done) return { done: false };
  if (result.error) return { done: true, error: (result.error.message as string | undefined) ?? "Generation failed" };

  const videos = result.response?.generatedVideos ?? [];
  if (videos.length === 0) {
    const reasons = result.response?.raiMediaFilteredReasons?.join(" ");
    return { done: true, error: reasons || "No video was returned (it may have been filtered)." };
  }
  return { done: true, videos: videos.map((_, i) => `/api/video/download?name=${encodeURIComponent(name)}&i=${i}`) };
}
