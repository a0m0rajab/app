import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isOperationName, VIDEO_MODELS } from "@/lib/gemini";
import { buildFounderPrompt, FOUNDER_NEGATIVE_PROMPT, SETTINGS, SHOTS, type Setting, type ShotStyle } from "@/lib/founder";
import { writeFounderLine } from "@/lib/founder-script";
import { generateStoryboard, TONES } from "@/lib/launch";
import { generateLaunchAudio, VOICES } from "@/lib/launch-audio";
import { getRenderJob, startRender } from "@/lib/render";
import { getVideoStatus, startVideo } from "@/lib/video";
import { FORMATS, type Format } from "@/components/launch/options";
import type { Storyboard } from "@/remotion/types";

// Tools agents can call. Each one wraps the same server code the app's API routes use.
export const MCP_TOOLS = [
  { name: "render_launch_video", summary: "Render the full launch video MP4 — script, voiceover and music — on the server." },
  { name: "get_launch_video_status", summary: "Poll a launch video render and get the MP4 link when it's done." },
  { name: "create_launch_storyboard", summary: "Write the copy and mock app screens for a launch video." },
  { name: "generate_launch_audio", summary: "Voiceover (Gemini TTS) and music bed (Lyria 3) for a storyboard." },
  { name: "write_founder_line", summary: "Draft the 8-second line a founder says to camera." },
  { name: "start_founder_video", summary: "Start a Veo 3.1 clip of the founder pitching from their photo." },
  { name: "get_video_status", summary: "Poll a Veo job and get the MP4 link when it's done." },
] as const;

const tones = Object.keys(TONES) as [keyof typeof TONES, ...(keyof typeof TONES)[]];
const shots = Object.keys(SHOTS) as [ShotStyle, ...ShotStyle[]];
const settings = Object.keys(SETTINGS) as [Setting, ...Setting[]];
const formats = Object.keys(FORMATS) as [Format, ...Format[]];

const json = (value: unknown) => ({ type: "text" as const, text: JSON.stringify(value, null, 2) });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

const storyboardShape = z
  .object({
    productName: z.string(),
    tagline: z.string(),
    problem: z.string(),
    navItems: z.array(z.string()).default([]),
    features: z.array(z.object({ title: z.string(), description: z.string() }).passthrough()).min(1),
    stats: z.array(z.object({ value: z.string(), label: z.string() })),
    cta: z.string(),
    url: z.string(),
    brandColor: z.string().default("#6366f1"),
  })
  .passthrough();

const imageInput = z.string().describe("Image as an https:// URL or a data:image/(png|jpeg|webp);base64 URL");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function loadImage(source: string) {
  const inline = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(source);
  if (inline) return { mimeType: inline[1], data: inline[2] };
  if (!/^https:\/\//.test(source)) throw new Error("Images must be https:// or data: URLs");
  const res = await fetch(source, { redirect: "follow" });
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!res.ok || !/^image\/(png|jpeg|webp)$/.test(mimeType)) throw new Error(`Could not load a PNG, JPEG or WebP image from ${source}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Images must be under 8 MB");
  return { mimeType, data: bytes.toString("base64") };
}

export function createMcpServer(origin: string) {
  const server = new McpServer({ name: "supafastlaunch", version: "0.1.0" });

  server.registerTool(
    "create_launch_storyboard",
    {
      title: "Create launch video storyboard",
      description:
        "Writes the script and realistic mock app screens for a SaaS launch video (hook, problem, 3 feature scenes, proof stats, call to action). " +
        "Use it to review or edit the copy, then pass it to render_launch_video for the MP4 or generate_launch_audio for sound only.",
      inputSchema: {
        productName: z.string().min(1),
        description: z.string().min(1).describe("What the product does, in a sentence or two"),
        audience: z.string().optional(),
        tone: z.enum(tones).default("punchy"),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Hex colour like #1f9d55"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return { content: [json({ storyboard: await generateStoryboard(args) })] };
      } catch (err) {
        return fail((err as Error).message);
      }
    },
  );

  server.registerTool(
    "render_launch_video",
    {
      title: "Render launch video",
      description:
        "Renders a finished SaaS launch video MP4 on the server with Remotion: animated scenes, a Gemini TTS voiceover and a Lyria music bed. " +
        "Pass a storyboard from create_launch_storyboard, or just productName + description and one is written for you. " +
        "Runs in the background (about 1-3 minutes): poll get_launch_video_status with the returned jobId every 10-15 seconds.",
      inputSchema: {
        storyboard: storyboardShape.optional().describe("A storyboard from create_launch_storyboard, edited or not"),
        productName: z.string().optional().describe("Required when no storyboard is given"),
        description: z.string().optional().describe("Required when no storyboard is given"),
        audience: z.string().optional(),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        tone: z.enum(tones).default("punchy"),
        seconds: z.number().int().min(10).max(90).default(30),
        format: z.enum(formats).default("landscape").describe("landscape 1920x1080, portrait 1080x1920, square 1080x1080"),
        sound: z.boolean().default(true).describe("Add the voiceover and music"),
        voice: z.enum(VOICES).optional(),
      },
      annotations: { openWorldHint: true },
    },
    async ({ storyboard, productName, description, audience, brandColor, ...options }) => {
      if (!storyboard && !(productName?.trim() && description?.trim())) return fail("Pass a storyboard, or productName and description");
      const job = startRender({
        ...options,
        storyboard: storyboard && ({ ...storyboard, brandColor: brandColor ?? storyboard.brandColor } as unknown as Storyboard),
        product: productName && description ? { productName, description, audience, brandColor } : undefined,
      });
      return { content: [json({ jobId: job.id, stage: job.stage, next: "Call get_launch_video_status with this jobId until stage is done." })] };
    },
  );

  server.registerTool(
    "get_launch_video_status",
    {
      title: "Get launch video status",
      description: "Checks a render started by render_launch_video. Stages: storyboard → sound → rendering → done. When done, returns the MP4 link.",
      inputSchema: { jobId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ jobId }) => {
      const job = getRenderJob(jobId);
      if (!job) return fail("Unknown jobId — renders are kept for an hour on the server that started them");
      return {
        content: [
          json({
            stage: job.stage,
            progress: Math.round(job.progress * 100),
            ...(job.stage === "done" && { video: `${origin}/api/launch/render?id=${job.id}` }),
            ...(job.error && { error: job.error }),
            ...(job.warnings.length && { warnings: job.warnings }),
            script: job.script,
            storyboard: job.stage === "done" ? job.storyboard : undefined,
          }),
        ],
        isError: job.stage === "error",
      };
    },
  );

  server.registerTool(
    "generate_launch_audio",
    {
      title: "Generate launch video sound",
      description:
        "Writes a voiceover that follows the storyboard's scenes and fits the length, voices it with Gemini TTS, and scores an instrumental music bed with Lyria 3 (a 30 second clip; loop or trim it to fit). " +
        "Returns the narration script plus WAV (voiceover) and MP3 (music) audio.",
      inputSchema: {
        storyboard: storyboardShape.describe("A storyboard from create_launch_storyboard"),
        seconds: z.number().int().min(10).max(90).default(30).describe("Video length the voiceover must fit"),
        tone: z.enum(tones).default("punchy"),
        voice: z.enum(VOICES).optional().describe("Override the voice picked for the tone"),
        voiceover: z.boolean().default(true),
        music: z.boolean().default(true),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ storyboard, ...rest }) => {
      const audio = await generateLaunchAudio({ storyboard: storyboard as unknown as Storyboard, ...rest });
      if (!audio.voiceover && !audio.music) return fail(audio.errors.join(" ") || "No audio was generated");
      return {
        content: [
          json({ script: audio.script, tracks: { voiceover: !!audio.voiceover, music: !!audio.music }, errors: audio.errors }),
          ...[audio.voiceover, audio.music].flatMap((clip) => (clip ? [{ type: "audio" as const, data: clip.data, mimeType: clip.mimeType }] : [])),
        ],
      };
    },
  );

  server.registerTool(
    "write_founder_line",
    {
      title: "Write founder line",
      description: "Drafts the single first-person line (14-20 words) a founder says to camera in an 8-second video.",
      inputSchema: {
        productName: z.string().min(1),
        description: z.string().min(1),
        founder: z.string().optional().describe('Name and title, like "Alex Rivera, Founder"'),
        shot: z.enum(shots).default("selfie"),
        angle: z.string().optional().describe("What the line should focus on, e.g. launch day or why they built it"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ shot, ...args }) => {
      try {
        return { content: [json({ line: await writeFounderLine({ ...args, shot: SHOTS[shot].label }) })] };
      } catch (err) {
        return fail((err as Error).message);
      }
    },
  );

  server.registerTool(
    "start_founder_video",
    {
      title: "Start founder video",
      description:
        "Starts an 8-second Veo 3.1 clip of the founder saying the line on camera, with real voice and sound, using their photo as the reference. " +
        "Takes a few minutes: poll get_video_status with the returned operation every 10-20 seconds.",
      inputSchema: {
        productName: z.string().min(1),
        line: z.string().min(1).describe("What the founder says. Use write_founder_line to draft one."),
        founderPhoto: imageInput.describe("Clear, front-facing photo of the founder (https:// or data: URL)"),
        productImage: imageInput.optional().describe("Optional product screenshot, device or logo"),
        placeImage: imageInput.optional().describe("Optional photo of the office, studio or brand look"),
        founder: z.string().optional(),
        shot: z.enum(shots).default("selfie"),
        setting: z.enum(settings).default("office"),
        aspectRatio: z.enum(["16:9", "9:16"]).default("9:16"),
        resolution: z.enum(["720p", "1080p"]).default("720p"),
        model: z.enum(["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview"]).default(VIDEO_MODELS[0]),
      },
      annotations: { openWorldHint: true },
    },
    async (args) => {
      try {
        const [founderPhoto, productImage, placeImage] = await Promise.all(
          [args.founderPhoto, args.productImage, args.placeImage].map((src) => (src ? loadImage(src) : undefined)),
        );
        const prompt = buildFounderPrompt({
          founder: args.founder ?? "",
          productName: args.productName,
          line: args.line,
          shot: args.shot,
          setting: args.setting,
          hasProduct: !!productImage,
          hasPlace: !!placeImage,
        });
        const operation = await startVideo({
          prompt,
          model: args.model,
          aspectRatio: args.aspectRatio,
          resolution: args.resolution,
          negativePrompt: FOUNDER_NEGATIVE_PROMPT,
          referenceImages: [founderPhoto, productImage, placeImage].filter((i) => !!i),
        });
        return { content: [json({ operation, prompt, next: "Call get_video_status with this operation until done is true." })] };
      } catch (err) {
        return fail((err as Error).message);
      }
    },
  );

  server.registerTool(
    "get_video_status",
    {
      title: "Get video status",
      description: "Checks a Veo job started by start_founder_video. When done, returns direct MP4 download links.",
      inputSchema: { operation: z.string().describe("The operation name returned by start_founder_video") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ operation }) => {
      if (!isOperationName(operation)) return fail("Invalid operation name");
      try {
        const status = await getVideoStatus(operation);
        return { content: [json("videos" in status ? { ...status, videos: status.videos.map((v) => origin + v) } : status)] };
      } catch (err) {
        return fail((err as Error).message);
      }
    },
  );

  return server;
}
