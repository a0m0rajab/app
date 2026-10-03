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

export const LAUNCH_PRESETS = [
  { id: "product-hunt", label: "Product Hunt", seconds: 30, format: "landscape", tone: "punchy" },
  { id: "reels", label: "Reels & TikTok", seconds: 15, format: "portrait", tone: "playful" },
  { id: "linkedin", label: "LinkedIn post", seconds: 30, format: "square", tone: "calm" },
  { id: "x-teaser", label: "X teaser", seconds: 15, format: "landscape", tone: "punchy" },
  { id: "investor", label: "Investor demo", seconds: 60, format: "landscape", tone: "calm" },
] as const satisfies readonly ({ id: string; label: string } & Omit<LaunchOptions, "brandColor">)[];

// Sample product both screens open with, so they're ready to run straight away.
export const SAMPLE_PRODUCT = {
  founder: "Alex Rivera, Founder",
  productName: "Ledgerly",
  description: "Invoicing and expense tracking for freelancers who hate spreadsheets.",
  shortDescription: "Invoicing for freelancers",
  brandColor: "#1f9d55",
};
