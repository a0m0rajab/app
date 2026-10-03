import { generateLaunchAudio, type LaunchAudioRequest } from "@/lib/launch-audio";

// Narration + TTS and the Lyria track run in parallel, but each can take a while.
export const maxDuration = 120;

// Generate a voiceover and a music bed for a launch video storyboard.
export async function POST(request: Request) {
  const body = (await request.json()) as LaunchAudioRequest;
  if (!body.storyboard?.productName || !body.seconds) {
    return Response.json({ error: "A storyboard and length are required" }, { status: 400 });
  }

  const audio = await generateLaunchAudio(body);
  if (!audio.voiceover && !audio.music) return Response.json({ error: audio.errors.join(" ") || "No audio was generated" }, { status: 502 });
  return Response.json(audio);
}
