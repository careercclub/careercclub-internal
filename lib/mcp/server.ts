import "server-only";
import { recordServerError } from "@/lib/monitoring/errors";
import type { ConnectorUser } from "./oauth";
import { callTool, ToolError, tools } from "./tools";

// The connector's MCP messages (JSON-RPC 2.0 over Streamable HTTP, answered as plain JSON).

const MAX_BATCH = 20;
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS = [
  "CareerCclub Internal: the team's operations app (tickets, programs, content, CRM, partnerships, Job Vacancy MT, talent pool, competitors, customer knowledge, products, resources).",
  "Start with list_modules for module keys and field names, or search to find something by words.",
  "Reads show only what this person may see; writes are saved in their name with the app's rules. Nothing can be deleted, and passwords are never shown or set.",
  "Before add_record, update_record or an import that changes many rows, tell the person what will change. For imports, call with mode preview first, show the summary, then apply after they agree.",
].join(" ");

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type Reply = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: Reply["id"], result: unknown): Reply => ({ jsonrpc: "2.0", id, result });
const fail = (id: Reply["id"], code: number, message: string): Reply => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(message: Message, user: ConnectorUser): Promise<Reply | null> {
  const id = message.id ?? null;
  const isNotification = message.id === undefined;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") return isNotification ? null : fail(id, -32600, "Invalid request.");
  if (isNotification) return null;
  switch (message.method) {
    case "initialize": {
      const asked = String(message.params?.protocolVersion || "");
      return ok(id, { protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "careercclub-internal", title: "CareerCclub Internal", version: "1.0.0" }, instructions: INSTRUCTIONS });
    }
    case "ping": return ok(id, {});
    case "tools/list": return ok(id, { tools: tools() });
    case "tools/call": {
      const name = String(message.params?.name || "");
      const args = (message.params?.arguments && typeof message.params.arguments === "object" ? message.params.arguments : {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, user);
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: Array.isArray(result) ? { items: result } : result, isError: false });
      } catch (error) {
        if (error instanceof ToolError) return ok(id, { content: [{ type: "text", text: error.message }], isError: true });
        void recordServerError({ kind: "api", place: `mcp:${name}`, error }).catch(() => {});
        return ok(id, { content: [{ type: "text", text: "Something went wrong on the server. Nothing more was changed; try again later." }], isError: true });
      }
    }
    default: return fail(id, -32601, `Unknown method ${message.method}.`);
  }
}

/** One message or a batch; null when there is nothing to answer (notifications only). */
export async function answer(body: unknown, user: ConnectorUser): Promise<Reply | Reply[] | null> {
  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) return fail(null, -32600, `At most ${MAX_BATCH} messages per batch.`);
    // One after another: a batch must not run many table reads at once.
    const replies: Reply[] = [];
    for (const item of body) { const reply = await handle(item as Message, user); if (reply) replies.push(reply); }
    return replies.length ? replies : null;
  }
  if (!body || typeof body !== "object") return fail(null, -32700, "Parse error.");
  return handle(body as Message, user);
}
