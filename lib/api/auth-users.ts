import "server-only";
import bcrypt from "bcryptjs";
import { listRows } from "@/lib/db/query";
import { createTableApi, type ApiRecord } from "./_crud";

export type AuthUserRecord = ApiRecord & {
  email: string;
  name: string | null;
  password_hash: string;
  role: string | null;
  is_active: boolean | null;
};

const authUsers = createTableApi<AuthUserRecord>("auth_users", {
  orderBy: "created_at",
  ascending: false,
});

export const listAuthUsers = authUsers.list;
export const countAuthUsers = authUsers.count;
export const getAuthUser = authUsers.get;
export const createAuthUser = authUsers.create;
export const updateAuthUser = authUsers.update;
export const deleteAuthUser = authUsers.remove;

export async function getAuthUserByEmail(email: string) {
  const [user] = await listRows<AuthUserRecord>("auth_users", {
    eq: { email: email.toLowerCase() },
    limit: 1,
  });

  return user ?? null;
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
