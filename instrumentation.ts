// Runs once when the Next.js server starts (see node_modules/next/dist/docs/.../instrumentation.md).
// Background jobs only on the Node.js server (the VPS), never during the build or on the edge.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.BACKGROUND_JOBS === "off" || !process.env.DATABASE_URL) return;
  const { startTalentSheetScheduler } = await import("./lib/talent-pool/scheduler");
  startTalentSheetScheduler();
}
