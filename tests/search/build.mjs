// Bundles the real global search (lib/search/query.ts) so run.mjs can call it against a
// throwaway Postgres. Run: node tests/search/build.mjs && SEARCH_TEST_DATABASE_URL=… node tests/search/run.mjs
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const R = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
await build({
  stdin: { contents: 'export { searchEverything, searchSpecs, searchWithKeywords } from "@/lib/search/query";', resolveDir: R, loader: "ts" },
  outfile: `${here}out/search.mjs`, bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "error", tsconfig: `${R}/tsconfig.json`, nodePaths: [`${R}/node_modules`],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  alias: { "server-only": `${R}/tests/imports/stubs/empty.ts`, "@": R },
});

// The "Ask AI" route, with auth stubbed (run.mjs replaces fetch for api.anthropic.com).
await build({
  entryPoints: [`${R}/app/api/search/ai/route.ts`], outfile: `${here}out/ai-route.mjs`, bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "error", tsconfig: `${R}/tsconfig.json`, nodePaths: [`${R}/node_modules`],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  alias: { "server-only": `${R}/tests/imports/stubs/empty.ts`, "@/auth": `${R}/tests/imports/stubs/auth.ts`, "@": R },
});
