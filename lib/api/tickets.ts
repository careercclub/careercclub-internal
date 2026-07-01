import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

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

export const listTicketPeople = people.list;
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

export function appendTicketComment(id: string, comment: { user: string; time: string; text: string }) {
  return withPostgres(async (sql) => {
    const [ticket] = await sql<TicketRecord[]>`
      update tickets
      set komentar = coalesce(komentar, '[]'::jsonb) || ${JSON.stringify([comment])}::jsonb
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
      set files = coalesce(files, '[]'::jsonb) || ${JSON.stringify([file])}::jsonb
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
      set links = coalesce(links, '[]'::jsonb) || ${JSON.stringify([link])}::jsonb
      where id = ${id}
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
        ${source.requester_id || null}, ${source.due_date || null}, ${JSON.stringify(source.attachments || [])}::jsonb,
        'Duplicate', ${JSON.stringify(source.cc || [])}::jsonb, ${JSON.stringify(source.links || [])}::jsonb,
        ${JSON.stringify(source.files || [])}::jsonb, '[]'::jsonb,
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
        ${input.requesterId || null}, ${input.dueDate || null}, ${JSON.stringify(input.cc || [])}::jsonb,
        ${JSON.stringify(input.links || [])}::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
        ${(input.notificationRoles && input.notificationRoles.length ? input.notificationRoles : ["admin"])}::text[], 'Manual', false
      ) returning *
    `;
    return created;
  }));
}
