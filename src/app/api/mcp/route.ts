import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";

// Generating audio can take a while; Veo jobs are started here and polled separately.
export const maxDuration = 120;

// Stateless MCP over Streamable HTTP: a fresh server per request, JSON responses, no sessions.
async function handle(request: Request) {
  const server = createMcpServer(new URL(request.url).origin);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
