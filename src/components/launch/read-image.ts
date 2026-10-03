import type { Shot } from "./options";

// Downscale so images stay light enough to send to Gemini/Veo and render into video.
export async function readImage(file: File): Promise<Shot> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { id: crypto.randomUUID(), name: file.name, url: canvas.toDataURL("image/jpeg", 0.9) };
}
