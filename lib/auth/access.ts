// Who may keep using the app. Checked on sign-in AND while signed in: a session is a signed
// cookie that would otherwise stay valid for weeks, so blocking someone (Settings → Users &
// roles → Access: Blocked) must also end the session they already have. Pure: tested under
// `node --test`; the database read is injected.

export type AccessRow = { role: string | null; is_active: boolean | null } | null | undefined;
export type Access = { role: string } | null;

/** null = no longer allowed (account removed or Blocked). */
export function accessFrom(row: AccessRow): Access {
  if (!row || row.is_active === false) return null;
  return { role: (row.role || "member").toLowerCase() };
}

/** Re-reads access at most once per `ttlMs` per user, so each page view does not hit the database. */
export function createAccessCheck(read: (id: string) => Promise<AccessRow>, ttlMs = 60_000, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; access: Access }>();
  return {
    async check(id: string): Promise<Access> {
      const hit = cache.get(id);
      if (hit && now() - hit.at < ttlMs) return hit.access;
      const access = accessFrom(await read(id));
      cache.set(id, { at: now(), access });
      return access;
    },
    /** Called after an admin changes someone's access, so it applies at once on this server. */
    forget(id: string) { cache.delete(id); },
  };
}
