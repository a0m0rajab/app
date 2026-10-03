import { generateStoryboard, type LaunchRequest } from "@/lib/launch";

export async function POST(request: Request) {
  const body = (await request.json()) as LaunchRequest;
  if (!body.productName?.trim() || !body.description?.trim()) {
    return Response.json({ error: "Product name and description are required" }, { status: 400 });
  }

  try {
    return Response.json({ storyboard: await generateStoryboard(body) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
