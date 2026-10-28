import "server-only";
import type postgres from "postgres";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";
import { findTicketPerson, TICKET_VISIBILITY_COLUMNS, ticketVisibility, type TicketViewer } from "@/lib/tickets/visibility";
import { isOverdue } from "@/lib/dashboard/summary";

export type TicketRecord = ApiRecord;
export type TicketDivisionRecord = ApiRecord;
export type TicketPersonRecord = ApiRecord;
export type TicketTypeRecord = ApiRecord;

const tickets = createTableApi<TicketRecord>("tickets", {
  orderBy: "created_at",
  ascending: false,
});

const divisions = createTableApi<TicketDivisionRecord>("tkt_divisi", {
  orderBy: "nama",
  ascending: true,
});

const people = createTableApi<TicketPersonRecord>("tkt_people", {
  orderBy: "nama",
  ascending: true,
});

const types = createTableApi<TicketTypeRecord>("tkt_types", {
  orderBy: "nama",
  ascending: true,
});

export const listTickets = tickets.list;
export const countTickets = tickets.count;
export const getTicket = tickets.get;
export const createTicket = tickets.create;
export const updateTicket = tickets.update;
export const deleteTicket = tickets.remove;

export const listTicketDivisions = divisions.list;
export const createTicketDivision = divisions.create;
export const updateTicketDivision = divisions.update;
export const deleteTicketDivision = divisions.remove;

/**
 * Ticket people, each marked `blocked` when their sign-in account is Blocked (Settings → Users &
 * roles). Matched by the linked account, or by email for a person without one. Pickers hide
 * blocked people (lib/tickets/people.ts); their names still show on old tickets.
 */
export function listTicketPeople() {
  return withPostgres((sql) => sql<TicketPersonRecord[]>`
    select p.*, ${BLOCKED_PERSON_SQL(sql)} as blocked
    from tkt_people p
    order by p.nama asc`);
}

/** The one "is this person's account Blocked" test (`p` = tkt_people), for every list of people. */
export function BLOCKED_PERSON_SQL(sql: postgres.Sql | postgres.TransactionSql) {
  return sql`exists (
      select 1 from auth_users u
      where u.is_active is false
        and (u.id::text = p.auth_user_id::text
          or (p.auth_user_id is null and lower(btrim(u.email)) = lower(btrim(p.email))))
    )`;
}
export const createTicketPerson = people.create;
export const updateTicketPerson = people.update;
export const deleteTicketPerson = people.remove;

export const listTicketTypes = types.list;
export const createTicketType = types.create;
export const updateTicketType = types.update;
export const deleteTicketType = types.remove;

export async function getTicketWorkspace() {
  const [ticketRows, divisionRows, peopleRows, typeRows] = await Promise.all([
    listTickets(), listTicketDivisions(), listTicketPeople(), listTicketTypes(),
  ]);
  return { tickets: ticketRows, divisions: divisionRows, people: peopleRows, types: typeRows };
}

/**
 * The ticket workspace limited to what this viewer may see. Every page that shows
 * tickets (Tickets, Dashboard calendar, Program calendar) goes through here, so the
 * role rule is applied the same way everywhere.
 */
export async function getVisibleTicketWorkspace(viewer: TicketViewer) {
  const workspace = await getTicketWorkspace();
  const me = findTicketPerson(viewer, workspace.people);
  return { ...workspace, meId: me ? String(me.id) : null, tickets: workspace.tickets.filter(ticketVisibility(viewer, workspace.people)) };
}

/** Nav badge: late tickets this viewer can open — the same "late" rule as Dashboard and Tickets. */
export async function countLateVisibleTickets(viewer: TicketViewer, today: string) {
  const admin = String(viewer.role || "").toLowerCase() === "admin";
  const [peopleRows, ticketRows] = await Promise.all([
    admin ? Promise.resolve([] as TicketPersonRecord[]) : listTicketPeople(),
    withPostgres((sql) => sql<TicketRecord[]>`select ${sql([...new Set(["id", "status", "due_date", ...TICKET_VISIBILITY_COLUMNS])])} from tickets where status not in ('Done', 'Cancelled') and due_date is not null`),
  ]);
  const visible = admin ? [...ticketRows] : [...ticketRows].filter(ticketVisibility(viewer, peopleRows));
  return visible.filter((row) => isOverdue(row, today)).length;
}

/** Nav badge: same rule as the pages, reading only the columns the rule needs. */
export async function countVisibleTickets(viewer: TicketViewer) {
  if (String(viewer.role || "").toLowerCase() === "admin") return countTickets();
  const [peopleRows, ticketRows] = await Promise.all([
    listTicketPeople(),
    withPostgres((sql) => sql<TicketRecord[]>`select ${sql(["id", ...TICKET_VISIBILITY_COLUMNS])} from tickets`),
  ]);
  return [...ticketRows].filter(ticketVisibility(viewer, peopleRows)).length;
}

export function appendTicketComment(id: string, comment: { user: string; time: string; text: string }) {
  return withPostgres(async (sql) => {
    const [ticket] = await sql<TicketRecord[]>`
      update tickets
      set komentar = coalesce(komentar, '[]'::jsonb) || ${sql.json([comment])}::jsonb
      where id = ${id}
      returning *
    `;
    return ticket || null;
  });
}

export function appendTicketFile(id: string, file: { name: string; key: string; type: string; size: number }) {
  return withPostgres(async (sql) => {
    const [ticket] = await sql<TicketRecord[]>`
      update tickets
      set files = coalesce(files, '[]'::jsonb) || ${sql.json([file])}::jsonb
      where id = ${id}
      returning *
    `;
    return ticket || null;
  });
}

export function appendTicketLink(id: string, link: { label: string; url: string }) {
  return withPostgres(async (sql) => {
    const [ticket] = await sql<TicketRecord[]>`
      update tickets
      set links = coalesce(links, '[]'::jsonb) || ${sql.json([link])}::jsonb
      where id = ${id}
      returning *
    `;
    return ticket || null;
  });
}

/** Removes the link at `index` only if it is still the one shown (url match), so two people removing at once cannot drop the wrong link. */
export function removeTicketLink(id: string, index: number, url: string) {
  return withPostgres(async (sql) => {
    const [ticket] = await sql<TicketRecord[]>`
      update tickets
      set links = (coalesce(links, '[]'::jsonb) - ${index}::int)
      where id = ${id} and coalesce(links, '[]'::jsonb) -> ${index}::int ->> 'url' = ${url}
      returning *
    `;
    return ticket || null;
  });
}

export function duplicateTicket(id: string) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [source] = await tx<TicketRecord[]>`select * from tickets where id = ${id}`;
    if (!source) throw new Error("Ticket not found.");
    await tx`select pg_advisory_xact_lock(hashtext('ccc_ops_ticket_number'))`;
    const [numberRow] = await tx<{ next_number: number }[]>`
      select coalesce(max(nullif(regexp_replace(ticket_no, '\\D', '', 'g'), '')::integer), 0) + 1 as next_number from tickets
    `;
    const ticketNo = `TKT-${String(numberRow?.next_number || 1).padStart(3, "0")}`;
    const [created] = await tx<TicketRecord[]>`
      insert into tickets (
        ticket_no, title, description, status, priority, type_id, divisi_id,
        assigned_to_id, assigned_to_ids, requester_id, due_date, attachments,
        source, cc, links, files, komentar, notification_roles, gcal_added
      ) values (
        ${ticketNo}, ${`${String(source.title || "Untitled")} (Copy)`}, ${source.description || ""},
        'Todo', ${source.priority || "Med"}, ${source.type_id || null}, ${source.divisi_id || null},
        ${source.assigned_to_id || null}, ${Array.isArray(source.assigned_to_ids) ? source.assigned_to_ids : []}::uuid[],
        ${source.requester_id || null}, ${source.due_date || null}, ${tx.json(source.attachments || [])}::jsonb,
        'Duplicate', ${tx.json(source.cc || [])}::jsonb, ${tx.json(source.links || [])}::jsonb,
        ${tx.json(source.files || [])}::jsonb, '[]'::jsonb,
        ${Array.isArray(source.notification_roles) ? source.notification_roles : ["admin"]}::text[], false
      ) returning *
    `;
    return created;
  }));
}

export function insertTicket(input: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  typeId?: string | null;
  divisionId?: string | null;
  assignedToIds?: string[];
  requesterId?: string | null;
  dueDate?: string | null;
  cc?: string[];
  links?: { label: string; url: string }[];
  notificationRoles?: string[];
}) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('ccc_ops_ticket_number'))`;
    const [numberRow] = await tx<{ next_number: number }[]>`
      select coalesce(max(nullif(regexp_replace(ticket_no, '\\D', '', 'g'), '')::integer), 0) + 1 as next_number from tickets
    `;
    const ticketNo = `TKT-${String(numberRow?.next_number || 1).padStart(3, "0")}`;
    const assignees = (input.assignedToIds || []).filter(Boolean);
    const [created] = await tx<TicketRecord[]>`
      insert into tickets (
        ticket_no, title, description, status, priority, type_id, divisi_id,
        assigned_to_id, assigned_to_ids, requester_id, due_date, cc, links, files,
        komentar, attachments, notification_roles, source, gcal_added
      ) values (
        ${ticketNo}, ${input.title}, ${input.description || ""}, ${input.status || "Todo"}, ${input.priority || "Med"},
        ${input.typeId || null}, ${input.divisionId || null}, ${assignees[0] || null}, ${assignees}::uuid[],
        ${input.requesterId || null}, ${input.dueDate || null}, ${tx.json(input.cc || [])}::jsonb,
        ${tx.json(input.links || [])}::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
        ${(input.notificationRoles && input.notificationRoles.length ? input.notificationRoles : ["admin"])}::text[], 'Manual', false
      ) returning *
    `;
    return created;
  }));
}
