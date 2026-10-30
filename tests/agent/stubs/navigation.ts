// next/navigation stub for the connector tests: redirect() throws with the target, like Next does.
export function redirect(url: string): never { const error = new Error("NEXT_REDIRECT") as Error & { url: string }; error.url = url; throw error; }
export function notFound(): never { throw new Error("NEXT_NOT_FOUND"); }
export function unstable_rethrow(error: unknown) { if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error; }
