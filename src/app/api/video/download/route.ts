import { GenerateVideosOperation } from "@google/genai";
import { ai, isOperationName } from "@/lib/gemini";

// Stream a finished video to the browser so the API key never leaves the server.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = params.get("name");
  const index = Number(params.get("i") ?? 0);
  if (!isOperationName(name)) return new Response("Invalid operation name", { status: 400 });

  const operation = new GenerateVideosOperation();
  operation.name = name;
  const result = await ai.operations.getVideosOperation({ operation });
  const uri = result.response?.generatedVideos?.[index]?.video?.uri;
  if (!uri) return new Response("Video not found", { status: 404 });

  const upstream = await fetch(uri, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! } });
  if (!upstream.ok || !upstream.body) return new Response("Failed to fetch video", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "video/mp4",
      "Content-Disposition": `inline; filename="veo-${index}.mp4"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
