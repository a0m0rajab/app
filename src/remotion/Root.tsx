import type { CSSProperties } from "react";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { AbsoluteFill, Composition, staticFile } from "remotion";
import { FPS, LaunchVideo, launchDuration } from "./LaunchVideo";
import { SAMPLE_STORYBOARD, type LaunchVideoProps } from "./types";

// Entry for server renders through the Remotion CLI (`remotion render src/remotion/index.ts launch-video`).
// Audio arrives as file names in the render's public dir, since the CLI can't take object URLs.
type RenderProps = Omit<LaunchVideoProps, "audio"> & {
  width: number;
  height: number;
  audioFiles?: { voiceover?: string; music?: string };
};

// The app gets these from next/font; outside Next we load them and fill the same CSS variables.
const fonts = {
  "--font-inter-tight": loadInterTight("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] }).fontFamily,
  "--font-geist-sans": loadGeist("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily,
  "--font-geist-mono": loadGeistMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily,
} as CSSProperties;

function RenderedLaunchVideo({ audioFiles, ...props }: RenderProps) {
  const audio = audioFiles && {
    voiceover: audioFiles.voiceover && staticFile(audioFiles.voiceover),
    music: audioFiles.music && staticFile(audioFiles.music),
  };
  return (
    <AbsoluteFill style={fonts}>
      <LaunchVideo {...props} audio={audio} />
    </AbsoluteFill>
  );
}

export function Root() {
  return (
    <Composition
      id="launch-video"
      component={RenderedLaunchVideo}
      fps={FPS}
      durationInFrames={launchDuration(SAMPLE_STORYBOARD, 30)}
      width={1920}
      height={1080}
      defaultProps={{ storyboard: SAMPLE_STORYBOARD, seconds: 30, width: 1920, height: 1080 } as RenderProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: launchDuration(props.storyboard, props.seconds),
        width: props.width,
        height: props.height,
      })}
    />
  );
}
