import { Type } from "@google/genai";
import { ai } from "@/lib/gemini";
import { toTone, type Tone } from "@/lib/launch";
import type { Storyboard } from "@/remotion/types";

const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts";
// Lyria 3 Clip always returns a 30 second track; the video loops or trims it.
const MUSIC_MODEL = process.env.GEMINI_MUSIC_MODEL ?? "lyria-3-clip-preview";

export const VOICES = ["Puck", "Kore", "Fenrir", "Sulafat", "Charon", "Zephyr", "Aoede", "Achird"] as const;

const VOICE_STYLE: Record<Tone, { voice: (typeof VOICES)[number]; style: string; music: string; wordsPerSecond: number }> = {
  punchy: {
    voice: "Puck",
    style: "confident, upbeat product-launch announcer, brisk energetic pace",
    music: "Driving, modern electronic pop with punchy drums and a bright synth hook, building energy",
    wordsPerSecond: 2.5,
  },
  calm: {
    voice: "Sulafat",
    style: "warm, reassuring and unhurried, like a trusted friend",
    music: "Warm, airy ambient piano and soft pads with a gentle pulse, optimistic and calm",
    wordsPerSecond: 2.1,
  },
  playful: {
    voice: "Fenrir",
    style: "playful and cheeky with a smile in the voice, lively pace",
    music: "Bouncy, quirky indie pop with plucky ukulele, claps and whistles, fun and light-hearted",
    wordsPerSecond: 2.4,
  },
};

export type AudioClip = { data: string; mimeType: string };

export type LaunchAudio = {
  script?: string;
  voiceover?: AudioClip;
  music?: AudioClip;
  // Per-track failures, so one bad track doesn't throw away the other.
  errors: string[];
};

export type LaunchAudioRequest = {
  storyboard: Storyboard;
  seconds: number;
  tone?: string;
  voice?: string;
  voiceover?: boolean;
  music?: boolean;
};

// Voiceover copy that follows the scenes and fits the video length when spoken.
export async function writeNarration(storyboard: Storyboard, seconds: number, tone: Tone) {
  // Leave breathing room for the intro and the final logo.
  const words = Math.max(12, Math.round(seconds * VOICE_STYLE[tone].wordsPerSecond * 0.8));
  const prompt = `Write the voiceover for a ${seconds}-second launch video for ${storyboard.productName}.
The scenes, in order:
1. Hook: ${storyboard.productName} — ${storyboard.tagline}
2. Problem: ${storyboard.problem}
${storyboard.features.map((f, i) => `${i + 3}. Feature: ${f.title} — ${f.description}`).join("\n")}
${storyboard.features.length + 3}. Proof: ${storyboard.stats.map((s) => `${s.value} ${s.label}`).join(", ")}
${storyboard.features.length + 4}. Call to action: ${storyboard.cta} (${storyboard.url})

Rules: follow the scene order, about ${words} words total (never more), spoken naturally by one narrator, no scene labels, no stage directions, no emojis. Say the product name at the start and end.`;

  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { script: { type: Type.STRING } }, required: ["script"] },
    },
  });
  const { script } = JSON.parse(res.text ?? "{}") as { script?: string };
  if (!script?.trim()) throw new Error("No voiceover script was returned");
  return script.trim();
}

export async function speak(text: string, tone: Tone, voice?: string): Promise<AudioClip> {
  const preset = VOICE_STYLE[tone];
  const interaction = await ai.interactions.create({
    model: TTS_MODEL,
    input: [
      {
        type: "user_input",
        content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: preset.style }] }],
      },
    ],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: voice && (VOICES as readonly string[]).includes(voice) ? voice : preset.voice }] },
  });
  const audio = interaction.output_audio;
  if (!audio?.data) throw new Error("No voiceover audio was returned");
  return toPlayable(audio.data, audio.mime_type, audio.sample_rate, audio.channels);
}

export async function composeMusic(storyboard: Storyboard, tone: Tone): Promise<AudioClip> {
  const interaction = await ai.interactions.create({
    model: MUSIC_MODEL,
    input: `Instrumental background music for a short product launch video for ${storyboard.productName}, a product that ${storyboard.tagline.replace(/\.$/, "").toLowerCase()}. ${VOICE_STYLE[tone].music}. No vocals, no lyrics. Sits under a voiceover, clean ending.`,
  });
  const audio = interaction.output_audio;
  if (!audio?.data) throw new Error("No music was returned");
  return toPlayable(audio.data, audio.mime_type ?? "audio/mpeg", audio.sample_rate, audio.channels);
}

export async function generateLaunchAudio(req: LaunchAudioRequest): Promise<LaunchAudio> {
  const tone = toTone(req.tone);
  const [voice, music] = await Promise.allSettled([
    req.voiceover === false
      ? Promise.resolve(undefined)
      : writeNarration(req.storyboard, req.seconds, tone).then(async (script) => ({ script, clip: await speak(script, tone, req.voice) })),
    req.music === false ? Promise.resolve(undefined) : composeMusic(req.storyboard, tone),
  ]);

  const errors: string[] = [];
  if (voice.status === "rejected") errors.push(`Voiceover: ${(voice.reason as Error).message}`);
  if (music.status === "rejected") errors.push(`Music: ${(music.reason as Error).message}`);
  return {
    script: voice.status === "fulfilled" ? voice.value?.script : undefined,
    voiceover: voice.status === "fulfilled" ? voice.value?.clip : undefined,
    music: music.status === "fulfilled" ? music.value : undefined,
    errors,
  };
}

// TTS can come back as raw 16-bit PCM; wrap it in a WAV header so browsers and Remotion can decode it.
function toPlayable(data: string, mimeType = "audio/wav", sampleRate = 24000, channels = 1): AudioClip {
  if (!/l16|pcm/i.test(mimeType)) return { data, mimeType };
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? sampleRate);
  const pcm = Buffer.from(data, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return { data: Buffer.concat([header, pcm]).toString("base64"), mimeType: "audio/wav" };
}
