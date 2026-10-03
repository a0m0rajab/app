import { Type } from "@google/genai";
import { ai } from "@/lib/gemini";

const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

type ScriptRequest = { founder?: string; productName?: string; description?: string; shot?: string };

// Draft the line a founder says to camera in an 8 second Veo clip.
export async function POST(request: Request) {
  const body = (await request.json()) as ScriptRequest;
  const productName = body.productName?.trim();
  const description = body.description?.trim();
  if (!productName || !description) {
    return Response.json({ error: "Product name and what it does are required" }, { status: 400 });
  }

  const prompt = `Write the single line a startup founder says straight to camera in an 8-second ${body.shot ?? "selfie"} video promoting their product.
Founder: ${body.founder?.trim() || "the founder"}
Product: ${productName}
What it does: ${description}

Rules: first person, conversational and genuine, no hype words, 14-20 words so it fits in 8 seconds when spoken. Mention ${productName} by name.`;

  try {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { line: { type: Type.STRING } }, required: ["line"] },
      },
    });
    const { line } = JSON.parse(res.text ?? "{}") as { line?: string };
    if (!line) throw new Error("No line was returned");
    return Response.json({ line: line.trim().replace(/^"|"$/g, "") });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
