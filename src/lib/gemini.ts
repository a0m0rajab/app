import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const VIDEO_MODELS = [
  "veo-3.1-fast-generate-preview",
  "veo-3.1-generate-preview",
  "veo-3.1-lite-generate-preview",
] as const;

// Operation names look like "models/veo-3.1-.../operations/abc123".
const OPERATION_NAME = /^models\/veo-[\w.-]+\/operations\/[\w-]+$/;

export function isOperationName(name: string | null): name is string {
  return !!name && OPERATION_NAME.test(name);
}
