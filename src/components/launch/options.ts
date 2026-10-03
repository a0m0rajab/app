export const FORMATS = {
  landscape: { label: "16:9 YouTube", short: "16:9", width: 1920, height: 1080 },
  portrait: { label: "9:16 Reels", short: "9:16", width: 1080, height: 1920 },
  square: { label: "1:1", short: "1:1", width: 1080, height: 1080 },
} as const;

export type Format = keyof typeof FORMATS;

export const LENGTHS = [15, 30, 60] as const;
export type Length = (typeof LENGTHS)[number];

export const TONES = ["punchy", "calm", "playful"] as const;
export type Tone = (typeof TONES)[number];

export type LaunchOptions = { seconds: Length; format: Format; tone: Tone; brandColor: string };

export type Shot = { id: string; name: string; url: string };

export const MAX_SHOTS = 6;
