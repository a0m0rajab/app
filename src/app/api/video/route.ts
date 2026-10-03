import { GenerateVideosOperation } from "@google/genai";
import { ai, isOperationName, VIDEO_MODELS } from "@/lib/gemini";

type StartRequest = {
  prompt: string;
  model?: (typeof VIDEO_MODELS)[number];
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p" | "4k";
  durationSeconds?: 4 | 6 | 8;
  negativePrompt?: string;
  image?: { data: string; mimeType: string };
};

// Start a Veo generation job. Returns the operation name to poll.
export async function POST(request: Request) {
  const body = (await request.json()) as StartRequest;
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

  const model = VIDEO_MODELS.includes(body.model!) ? body.model! : VIDEO_MODELS[0];

  try {
    const operation = await ai.models.generateVideos({
      model,
      prompt,
      image: body.image ? { imageBytes: body.image.data, mimeType: body.image.mimeType } : undefined,
      config: {
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        durationSeconds: body.durationSeconds,
        negativePrompt: body.negativePrompt?.trim() || undefined,
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
