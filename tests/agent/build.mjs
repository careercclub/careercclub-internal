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
await build({ ...common, stdin: { contents: 'export { createAgentToken, revokeAgentToken, listAgentTokens } from "@/lib/api/agent-tokens"; export { applyProspectImport } from "@/lib/api/mt-prospects"; export { importContentEvaluations } from "@/lib/api/content-evaluation"; export { closePostgresConnection } from "@/lib/db/postgres";', resolveDir: R, loader: "ts" }, outfile: `${here}out/helpers.mjs` });
