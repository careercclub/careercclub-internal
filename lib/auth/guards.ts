import "server-only";
import { auth } from "@/auth";

// One set of checks for every server action and route (Putaran 58). Thrown messages reach the
// person through lib/actions/expected.ts.

export type SessionUser = { id?: string | null; email?: string | null; name?: string | null; role?: string | null };

export const roleOf = (user: { role?: string | null } | null | undefined) => String(user?.role || "").trim().toLowerCase();

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user as SessionUser;
}

export async function requireRole(roles: readonly string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(roleOf(user))) throw new Error(roles.length === 1 && roles[0] === "admin" ? "Admin access required." : "You don’t have access to this.");
  return user;
}

export const requireAdmin = () => requireRole(["admin"]);
