import { isOperationName } from "@/lib/gemini";
import { getVideoStatus, startVideo, VideoRequestError, type StartRequest } from "@/lib/video";

// Start a Veo generation job. Returns the operation name to poll.
export async function POST(request: Request) {
  const body = (await request.json()) as StartRequest;
  if (!body.prompt?.trim()) return Response.json({ error: "Prompt is required" }, { status: 400 });

  try {
    return Response.json({ name: await startVideo(body) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: err instanceof VideoRequestError ? 400 : 502 });
  }
}

// Poll a generation job.
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name");
  if (!isOperationName(name)) return Response.json({ error: "Invalid operation name" }, { status: 400 });

  try {
    return Response.json(await getVideoStatus(name));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
