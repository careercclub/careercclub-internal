import "server-only";
import bcrypt from "bcryptjs";
import { withPostgres } from "@/lib/db/postgres";
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

export function listAuthRoles() {
  return withPostgres(async (sql) => {
    const rows = await sql<{ role: string }[]>`
      select distinct lower(coalesce(role, 'member')) as role
      from auth_users
      where is_active is true
      order by role
    `;

    return rows.map((row) => row.role);
  });
}

export function listSafeAuthUsers() {
  return withPostgres(async (sql) => {
    const rows = await sql<Array<Pick<AuthUserRecord, "id" | "email" | "name" | "role" | "is_active" | "created_at">>>`
      select id, email, name, role, is_active, created_at
      from auth_users
      order by created_at desc
    `;
    return [...rows];
  });
}

export async function createInternalUser(input: { email: string; name: string; role: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return withPostgres(async (sql) => {
    const [user] = await sql<AuthUserRecord[]>`
      insert into auth_users (email, name, role, password_hash, is_active)
      values (${input.email.toLowerCase()}, ${input.name}, ${input.role}, ${passwordHash}, true)
      returning *
    `;
    return user;
  });
}

export async function resetInternalUserPassword(id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return withPostgres(async (sql) => {
    await sql`update auth_users set password_hash = ${passwordHash} where id = ${id}`;
  });
}

export function updateInternalUserAccess(id: string, input: { role: string; isActive: boolean }) {
  return withPostgres(async (sql) => {
    await sql`update auth_users set role = ${input.role}, is_active = ${input.isActive} where id = ${id}`;
  });
}
