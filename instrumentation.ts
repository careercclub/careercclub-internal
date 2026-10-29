// Runs once when the Next.js server starts (see node_modules/next/dist/docs/.../instrumentation.md).
// Background jobs only on the Node.js server (the VPS), never during the build or on the edge.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.BACKGROUND_JOBS === "off" || !process.env.DATABASE_URL) return;
  const { startSheetSyncScheduler } = await import("./lib/sheet-sync/scheduler");
  startSheetSyncScheduler();
}

// Server errors on pages and API routes (server actions record their own in lib/actions/expected.ts):
// kept for admins in Settings → Errors (Putaran 58).
export async function onRequestError(error: { digest?: string } & Error, request: { path: string }, context: { routeType: string; routePath: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { recordServerError } = await import("./lib/monitoring/errors");
  const kind = context.routeType === "route" ? "api" : context.routeType === "action" ? "action" : "page";
  await recordServerError({ kind, place: context.routePath || request.path.split("?")[0], error, digest: error.digest });
}
