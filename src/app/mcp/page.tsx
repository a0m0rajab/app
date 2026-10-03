import type { Metadata } from "next";
import { headers } from "next/headers";
import { Eyebrow } from "@/components/launch/ui";
import { MCP_TOOLS } from "@/lib/mcp";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "MCP · SupaFastLaunch" };

export default async function McpPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const endpoint = `${protocol}://${host}/api/mcp`;

  const clients = [
    { name: "Claude Code", code: `claude mcp add --transport http supafastlaunch ${endpoint}` },
    { name: "Codex · ~/.codex/config.toml", code: `[mcp_servers.supafastlaunch]\nurl = "${endpoint}"` },
    { name: "Cursor, Windsurf & others · mcp.json", code: JSON.stringify({ mcpServers: { supafastlaunch: { url: endpoint } } }, null, 2) },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-white font-display text-ink">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 pt-10 pb-14 sm:px-14 lg:flex-row lg:gap-18 lg:pt-16">
        <div className="flex shrink-0 flex-col gap-8 lg:w-110">
          <div className="flex flex-col gap-5">
            <Eyebrow muted>MCP server · Streamable HTTP</Eyebrow>
            <h1 className="text-5xl/12 font-extrabold tracking-[-0.04em] sm:text-7xl/18">
              Launch from your{" "}
              <span className="relative inline-block">
                <span className="absolute inset-x-[-6px] top-[52%] h-[42%] -rotate-[1.5deg] rounded bg-sun" aria-hidden />
                <span className="relative">agent.</span>
              </span>
            </h1>
            <p className="text-[17px]/6.5 text-body">
              Connect Claude, Codex or Cursor to SupaFastLaunch and let your agent write launch storyboards, score them with a Gemini
              voiceover and Lyria music, and shoot founder videos with Veo.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <Eyebrow>Endpoint</Eyebrow>
            <div className="flex items-center gap-3 rounded-xl bg-ink p-3 pl-4">
              <code className="min-w-0 flex-1 truncate font-mono text-sm/5 text-white">{endpoint}</code>
              <CopyButton text={endpoint} />
            </div>
            <p className="text-[13px]/4.5 text-muted">No auth — it uses this server&apos;s Gemini key, so keep it on localhost or behind your own gateway.</p>
          </div>

          <div className="flex flex-col gap-3">
            <Eyebrow>Tools</Eyebrow>
            <ul className="flex flex-col gap-1.5">
              {MCP_TOOLS.map((tool) => (
                <li key={tool.name} className="flex flex-col gap-1 rounded-[10px] bg-paper p-3">
                  <code className="font-mono text-[13px]/4 font-semibold">{tool.name}</code>
                  <span className="text-sm/5 text-body">{tool.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Eyebrow>Connect a client</Eyebrow>
          {clients.map((client) => (
            <div key={client.name} className="flex flex-col gap-3 rounded-2xl bg-ink p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm/4.5 font-semibold text-white">{client.name}</span>
                <CopyButton text={client.code} />
              </div>
              <pre className="overflow-x-auto font-mono text-[13px]/5 text-white/80">{client.code}</pre>
            </div>
          ))}
          <div className="flex flex-col gap-2 rounded-2xl border border-edge p-4 sm:p-6">
            <span className="text-sm/4.5 font-semibold">Try it</span>
            <p className="text-sm/5 text-body">
              “Make a 30 second punchy launch storyboard for Ledgerly, invoicing for freelancers, then generate the voiceover and music.”
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
