import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FORMATS, type Format } from "@/components/launch/options";
import { generateStoryboard, type LaunchRequest } from "@/lib/launch";
import { generateLaunchAudio } from "@/lib/launch-audio";
import type { Storyboard } from "@/remotion/types";

// Server-side launch video renders through the Remotion CLI, run as background jobs that agents poll.

export type RenderRequest = {
  storyboard?: Storyboard;
  // Used to write a storyboard when none is given.
  product?: LaunchRequest;
  seconds: number;
  format: Format;
  tone?: string;
  sound: boolean;
  voice?: string;
};

export type RenderJob = {
  id: string;
  stage: "storyboard" | "sound" | "rendering" | "done" | "error";
  // 0-1 through the frame render.
  progress: number;
  createdAt: number;
  storyboard?: Storyboard;
  script?: string;
  warnings: string[];
  error?: string;
  file?: string;
  format: Format;
  seconds: number;
};

const ROOT = path.join(tmpdir(), "supafastlaunch-renders");
const ENTRY = path.join(process.cwd(), "src/remotion/index.ts");
const CLI = path.join(process.cwd(), "node_modules/.bin/remotion");
const MAX_AGE_MS = 60 * 60 * 1000;

// Survives dev-server module reloads.
const jobs: Map<string, RenderJob> = ((globalThis as { __launchRenders?: Map<string, RenderJob> }).__launchRenders ??= new Map());

export const getRenderJob = (id: string) => jobs.get(id);

export function startRender(req: RenderRequest): RenderJob {
  pruneOldJobs();
  const job: RenderJob = {
    id: randomUUID(),
    stage: req.storyboard ? "sound" : "storyboard",
    progress: 0,
    createdAt: Date.now(),
    storyboard: req.storyboard,
    warnings: [],
    format: req.format,
    seconds: req.seconds,
  };
  jobs.set(job.id, job);
  run(job, req).catch((err: Error) => Object.assign(job, { stage: "error", error: err.message }));
  return job;
}

async function run(job: RenderJob, req: RenderRequest) {
  const dir = path.join(ROOT, job.id);
  const publicDir = path.join(dir, "public");
  await mkdir(publicDir, { recursive: true });

  if (!job.storyboard) {
    if (!req.product) throw new Error("A storyboard or product details are required");
    job.storyboard = await generateStoryboard({ ...req.product, tone: req.tone });
  }
  const storyboard = job.storyboard;

  const audioFiles: { voiceover?: string; music?: string } = {};
  if (req.sound) {
    job.stage = "sound";
    const audio = await generateLaunchAudio({ storyboard, seconds: req.seconds, tone: req.tone, voice: req.voice });
    job.script = audio.script;
    job.warnings.push(...audio.errors);
    for (const [key, clip] of [["voiceover", audio.voiceover], ["music", audio.music]] as const) {
      if (!clip) continue;
      const name = `${key}.${clip.mimeType.includes("wav") ? "wav" : "mp3"}`;
      await writeFile(path.join(publicDir, name), Buffer.from(clip.data, "base64"));
      audioFiles[key] = name;
    }
  }

  job.stage = "rendering";
  const { width, height } = FORMATS[req.format];
  const propsFile = path.join(dir, "props.json");
  const file = path.join(dir, "launch.mp4");
  await writeFile(propsFile, JSON.stringify({ storyboard, seconds: req.seconds, width, height, audioFiles }));
  await renderWithCli(["render", ENTRY, "launch-video", file, `--props=${propsFile}`, `--public-dir=${publicDir}`, "--log=info"], (p) => {
    job.progress = p;
  });
  Object.assign(job, { stage: "done", progress: 1, file });
}

function renderWithCli(args: string[], onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(CLI, args, { cwd: process.cwd(), env: process.env });
    let tail = "";
    const read = (chunk: Buffer) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-2000);
      const matches = [...text.matchAll(/Rendered (\d+)\/(\d+)/g)];
      const last = matches.at(-1);
      if (last) onProgress(Number(last[1]) / Number(last[2]));
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Remotion render failed (exit ${code}): ${tail.trim().split("\n").slice(-5).join(" ")}`))));
  });
}

function pruneOldJobs() {
  for (const [id, job] of jobs) {
    if (Date.now() - job.createdAt < MAX_AGE_MS) continue;
    jobs.delete(id);
    rm(path.join(ROOT, id), { recursive: true, force: true }).catch(() => {});
  }
}
