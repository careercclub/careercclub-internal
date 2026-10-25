// Session stub for the agent tests: run.mjs sets globalThis.__session (null = signed out).
export async function auth() { return (globalThis as { __session?: unknown }).__session ?? null; }
