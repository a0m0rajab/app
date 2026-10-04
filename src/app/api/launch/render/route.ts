import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getRenderJob } from "@/lib/render";

// Download a launch video rendered on the server by the MCP's render_launch_video tool.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const job = getRenderJob(id);
  if (!job?.file) return new Response("Video not found or not finished", { status: 404 });

  const { size } = await stat(job.file);
  const name = `${(job.storyboard?.productName ?? "launch").toLowerCase().replace(/\W+/g, "-")}-launch-${job.seconds}s.mp4`;
  return new Response(Readable.toWeb(createReadStream(job.file)) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
