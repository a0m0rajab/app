// Shared by the founder page and the MCP server, so both build the same Veo prompt.

export const SHOTS = {
  selfie: { label: "Selfie vlog", text: "handheld selfie-style vlog shot, the founder holding the phone at arm's length" },
  interview: { label: "Interview", text: "seated interview shot on a tripod, framed from the chest up, slightly off-centre" },
  podcast: { label: "Podcast", text: "podcast-style shot, the founder speaking into a studio microphone" },
} as const;

export const SETTINGS = {
  office: { label: "Office", text: "in a bright, modern startup office with plants and laptops in the soft-focus background" },
  cafe: { label: "Café", text: "in a cosy café with warm window light and gentle background chatter" },
  outdoors: { label: "Outdoors", text: "walking down a sunny city street, golden hour light" },
  studio: { label: "Studio", text: "in a clean studio with a soft seamless backdrop and professional lighting" },
} as const;

export type ShotStyle = keyof typeof SHOTS;
export type Setting = keyof typeof SETTINGS;

export const FOUNDER_NEGATIVE_PROMPT = "subtitles, captions, text overlays, watermark, distorted face";

export function buildFounderPrompt(o: { founder: string; productName: string; line: string; shot: ShotStyle; setting: Setting; hasProduct: boolean; hasPlace: boolean }) {
  const who = o.founder.trim() ? `${o.founder.trim()}, the founder of ${o.productName.trim() || "the product"}` : "the founder";
  return [
    `A ${SHOTS[o.shot].text}, ${SETTINGS[o.setting].text}.`,
    `The person is ${who}, exactly as shown in the reference photo.`,
    o.hasProduct && `The product from the reference image is visible in the scene, held up or on a nearby screen.`,
    o.hasPlace && `The look and surroundings match the reference image of the space.`,
    o.line.trim() && `Looking into the camera, they say warmly and confidently: "${o.line.trim()}"`,
    "Authentic, natural lighting, shallow depth of field, real-world audio. No subtitles, captions or on-screen text.",
  ]
    .filter(Boolean)
    .join(" ");
}
