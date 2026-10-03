import { ai } from "@/lib/gemini";

const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

type Message = { role: "user" | "model"; text: string };

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
  }

  const { messages } = (await request.json()) as { messages: Message[] };

  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`\n\n[Error: ${(err as Error).message}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
