// Plain constants with no Remotion import, so server code (the music prompt) can share them.
export const FPS = 30;
// The music is scored at this tempo, so scene cuts are quantised to whole beats.
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM;
