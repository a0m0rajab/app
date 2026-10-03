import { Type } from "@google/genai";
import { ai } from "@/lib/gemini";

const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export type ScriptRequest = { founder?: string; productName: string; description: string; shot?: string; angle?: string };

// Draft the line a founder says to camera in an 8 second Veo clip.
export async function writeFounderLine(body: ScriptRequest) {
  const productName = body.productName.trim();
  const prompt = `Write the single line a startup founder says straight to camera in an 8-second ${body.shot ?? "selfie"} video promoting their product.
Founder: ${body.founder?.trim() || "the founder"}
Product: ${productName}
What it does: ${body.description.trim()}
${body.angle?.trim() ? `Angle: ${body.angle.trim().slice(0, 200)}` : ""}

Rules: first person, conversational and genuine, no hype words, 14-20 words so it fits in 8 seconds when spoken. Mention ${productName} by name.`;

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
  return line.trim().replace(/^"|"$/g, "");
}
