// Claude access keys: "ccc_" + 32 random bytes (base64url). Only the SHA-256 hash is stored;
// the first characters are kept as a visible prefix so a key can be recognised in Settings.
// Pure apart from node:crypto; tested under `node --test`.
import { createHash, randomBytes } from "node:crypto";

export { AGENT_MODULES, isAgentModule, type AgentModule } from "./modules.ts";

export function newAgentKey() {
  const key = `ccc_${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashAgentKey(key), prefix: key.slice(0, 10) };
}

export function hashAgentKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** "Bearer ccc_…" → the key; anything else → null. */
export function keyFromHeader(header: string | null | undefined) {
  const match = /^Bearer\s+(ccc_[A-Za-z0-9_-]{30,80})\s*$/.exec(header || "");
  return match ? match[1] : null;
}
