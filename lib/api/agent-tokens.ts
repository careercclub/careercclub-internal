import "server-only";
import { auth } from "@/auth";
import { withPostgres } from "@/lib/db/postgres";
import { hashAgentKey, isAgentModule, keyFromHeader, newAgentKey, type AgentModule } from "@/lib/agent/token-format";

export type AgentTokenRow = { id: string; name: string; token_prefix: string; modules: string[]; created_by: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

export function listAgentTokens(): Promise<AgentTokenRow[]> {
  return withPostgres(async (sql) => {
    const rows = await sql<AgentTokenRow[]>`select id, name, token_prefix, modules, created_by, created_at, last_used_at, revoked_at from agent_tokens order by revoked_at nulls first, created_at desc`;
    return rows.map((row) => ({ ...row, id: String(row.id), modules: row.modules || [], created_at: iso(row.created_at) || "", last_used_at: iso(row.last_used_at), revoked_at: iso(row.revoked_at) }));
  });
}

/** Makes a key; the plain key is returned once and never stored. */
export function createAgentToken(input: { name: string; modules: AgentModule[]; createdBy: string }) {
  const { key, hash, prefix } = newAgentKey();
  return withPostgres(async (sql) => {
    await sql`insert into agent_tokens (name, token_hash, token_prefix, modules, created_by) values (${input.name}, ${hash}, ${prefix}, ${input.modules}, ${input.createdBy})`;
    return { key, prefix };
  });
}

export function revokeAgentToken(id: string) {
  return withPostgres(async (sql) => { await sql`update agent_tokens set revoked_at = now() where id = ${id} and revoked_at is null`; });
}

export type AgentCaller = { kind: "key" | "user"; name: string; label: string };

/**
 * Who is calling an agent endpoint for `module`: a Claude access key (Authorization: Bearer
 * ccc_…) that is not revoked and covers the module, or a signed-in person (e.g. Claude in
 * their own browser). null = not allowed.
 */
export async function agentCaller(request: Request, module: AgentModule): Promise<AgentCaller | null> {
  const key = keyFromHeader(request.headers.get("authorization"));
  if (key) {
    const row = await withPostgres(async (sql) => {
      const [found] = await sql<Array<{ id: string; name: string; modules: string[] }>>`
        update agent_tokens set last_used_at = now()
        where token_hash = ${hashAgentKey(key)} and revoked_at is null
        returning id, name, modules`;
      return found;
    });
    if (!row || !(row.modules || []).filter(isAgentModule).includes(module)) return null;
    return { kind: "key", name: row.name, label: `Claude (${row.name})` };
  }
  const session = await auth();
  if (!session?.user) return null;
  const name = session.user.name || session.user.email || "CCC User";
  return { kind: "user", name, label: `Claude via ${name}` };
}
