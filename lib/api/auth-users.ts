import "server-only";
import type postgres from "postgres";
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
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [user] = await tx<AuthUserRecord[]>`
      insert into auth_users (email, name, role, password_hash, is_active)
      values (${input.email.toLowerCase()}, ${input.name}, ${input.role}, ${passwordHash}, true)
      returning *
    `;
    await ensureTicketPerson(tx, user);
    return user;
  }));
}

export async function resetInternalUserPassword(id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return withPostgres(async (sql) => {
    await sql`update auth_users set password_hash = ${passwordHash} where id = ${id}`;
  });
}

/** Current role and Access (Allowed/Blocked) of a signed-in user, by id. */
export function getAuthUserAccess(id: string) {
  return withPostgres(async (sql) => {
    const [row] = await sql<Array<Pick<AuthUserRecord, "role" | "is_active">>>`select role, is_active from auth_users where id = ${id} limit 1`;
    return row ?? null;
  });
}

export function updateInternalUserAccess(id: string, input: { role: string; isActive: boolean }) {
  return withPostgres(async (sql) => {
    await sql`update auth_users set role = ${input.role}, is_active = ${input.isActive} where id = ${id}`;
  });
}

/**
 * Every account is a ticket person (Putaran 57): without one the Tickets board is empty and the
 * account can't be assigned. An existing person with the same email is linked; otherwise one is
 * added. Division is left for an admin to set in Settings → Ticket setup.
 */
export async function ensureTicketPerson(sql: postgres.Sql | postgres.TransactionSql, user: Pick<AuthUserRecord, "id" | "email" | "name" | "role">) {
  const email = String(user.email || "").trim().toLowerCase();
  const [linked] = await sql`select id from tkt_people where auth_user_id = ${user.id} limit 1`;
  if (linked) return String(linked.id);
  if (email) {
    const [same] = await sql`update tkt_people set auth_user_id = ${user.id} where id = (select id from tkt_people where auth_user_id is null and lower(btrim(email)) = ${email} order by id limit 1) returning id`;
    if (same) return String(same.id);
  }
  const role = String(user.role || "").trim().toLowerCase();
  const level = role === "admin" ? "admin" : role === "lead" ? "lead" : "staff";
  const [created] = await sql`insert into tkt_people (nama, email, level, auth_user_id) values (${String(user.name || "").trim() || email.split("@")[0]}, ${email}, ${level}, ${user.id}) returning id`;
  return String(created.id);
}
