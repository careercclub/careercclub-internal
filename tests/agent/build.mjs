// Bundles the Claude access routes and helpers so run.mjs can call them against a throwaway
// Postgres. Run: npm run test:agent (needs AGENT_TEST_DATABASE_URL to a database it may wipe).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const R = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const common = {
  bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "error", tsconfig: `${R}/tsconfig.json`, nodePaths: [`${R}/node_modules`],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  alias: { "server-only": `${R}/tests/imports/stubs/empty.ts`, "@/auth": `${here}stubs/auth.ts`, "next/cache": `${R}/tests/imports/stubs/next-cache.ts`, "@": R },
};
await build({ ...common, entryPoints: [`${R}/app/api/agent/mt-prospects/route.ts`], outfile: `${here}out/mt-route.mjs` });
await build({ ...common, entryPoints: [`${R}/app/api/agent/instagram/route.ts`], outfile: `${here}out/ig-route.mjs` });
await build({ ...common, entryPoints: [`${R}/app/api/agent/customer-knowledge/route.ts`], outfile: `${here}out/ck-route.mjs` });
await build({ ...common, entryPoints: [`${R}/app/api/agent/competitor-intel/route.ts`], outfile: `${here}out/ci-route.mjs` });
await build({ ...common, stdin: { contents: 'export { createAgentToken, revokeAgentToken, listAgentTokens } from "@/lib/api/agent-tokens"; export { applyProspectImport } from "@/lib/api/mt-prospects"; export { importContentEvaluations } from "@/lib/api/content-evaluation"; export { closePostgresConnection } from "@/lib/db/postgres"; export { listTicketPeople } from "@/lib/api/tickets";', resolveDir: R, loader: "ts" }, outfile: `${here}out/helpers.mjs` });
await build({ ...common, stdin: { contents: 'export { createManagedRecord } from "@/app/actions/record-actions"; export { createManagedRecord as createManagedRecordClient } from "@/app/_actions/record-actions";', resolveDir: R, loader: "ts" }, outfile: `${here}out/records.mjs` });
await build({ ...common, stdin: { contents: 'export { applyOfflineChangeAction } from "@/app/actions/offline-actions";', resolveDir: R, loader: "ts" }, outfile: `${here}out/offline.mjs` });
await build({ ...common, stdin: { contents: 'export { deleteWithDependents, describeDelete } from "@/lib/records/delete"; export { bulkUpdateCrmBuyers } from "@/app/actions/crm-actions"; export { deleteManagedRecord } from "@/app/actions/record-actions";', resolveDir: R, loader: "ts" }, outfile: `${here}out/delete.mjs` });
await build({ ...common, stdin: { contents: 'export { createInternalUser } from "@/lib/api/auth-users"; export { publishTicketNotification, listNotificationsForUser } from "@/lib/api/notifications"; export { createTicketAction } from "@/app/actions/ticket-actions";', resolveDir: R, loader: "ts" }, outfile: `${here}out/people.mjs` });
await build({ ...common, stdin: { contents: 'export { changeTicketStatusAction, updateTicketDetailsAction, deleteTicketAction, duplicateTicketAction } from "@/app/actions/ticket-actions"; export { updateManagedRecord } from "@/app/actions/record-actions"; export { revealResourcePasswordAction } from "@/app/actions/resource-actions"; export { recordServerError, listServerErrors } from "@/lib/monitoring/errors"; export { expected } from "@/lib/actions/expected";', resolveDir: R, loader: "ts" }, outfile: `${here}out/access.mjs` });
// Claude connector (Putaran 62): sign-in, MCP endpoint, Settings disconnect.
await build({ ...common, alias: { ...common.alias, "next/navigation": `${here}stubs/navigation.ts` }, stdin: { contents: 'export { POST as mcpPOST, GET as mcpGET } from "@/app/api/mcp/route"; export { POST as registerPOST } from "@/app/api/oauth/register/route"; export { POST as tokenPOST } from "@/app/api/oauth/token/route"; export { POST as revokePOST } from "@/app/api/oauth/revoke/route"; export { GET as resourceGET } from "@/app/.well-known/oauth-protected-resource/api/mcp/route"; export { GET as serverGET } from "@/app/.well-known/oauth-authorization-server/route"; export { allowClaudeAction, denyClaudeAction } from "@/app/oauth/authorize/actions"; export { listConnections } from "@/lib/mcp/oauth"; export { disconnectClaudeAction } from "@/app/actions/agent-actions"; export { pkceChallenge } from "@/lib/mcp/oauth-rules";', resolveDir: R, loader: "ts" }, outfile: `${here}out/mcp.mjs` });
