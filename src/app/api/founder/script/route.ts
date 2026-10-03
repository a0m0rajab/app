import { writeFounderLine, type ScriptRequest } from "@/lib/founder-script";

export async function POST(request: Request) {
  const body = (await request.json()) as ScriptRequest;
  if (!body.productName?.trim() || !body.description?.trim()) {
    return Response.json({ error: "Product name and what it does are required" }, { status: 400 });
  }

  try {
    return Response.json({ line: await writeFounderLine(body) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
