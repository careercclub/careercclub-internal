// Bundles the real import routes (auth stubbed) so run.mjs can call them against a
// throwaway Postgres. Run through `npm run test:imports`.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const R = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const common = {
  bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "error", tsconfig: `${R}/tsconfig.json`, nodePaths: [`${R}/node_modules`],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  alias: { "@/auth": `${here}stubs/auth.ts`, "server-only": `${here}stubs/empty.ts`, "next/cache": `${here}stubs/next-cache.ts`, "@opennextjs/cloudflare": `${here}stubs/cf.ts`, "@": R },
};
for (const name of ["talent-pool", "crm", "content-evaluation", "instagram", "mt-prospects", "free-class"]) {
  await build({ ...common, entryPoints: [`${R}/app/api/${name}/import/route.ts`], outfile: `${here}out/${name}.mjs` });
}
