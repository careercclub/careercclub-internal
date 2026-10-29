"use server";

import { expected } from "@/lib/actions/expected";
import { requireTicketAccess } from "@/lib/tickets/access";
import { listTicketPeople } from "@/lib/api/tickets";
import { findTicketPerson } from "@/lib/tickets/visibility";
import { deleteWithDependents, describeDelete } from "@/lib/records/delete";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { normalizeNotificationRoles, publishTicketNotification } from "@/lib/api/notifications";
import {
  deleteProgramEventWithWorkflow,
  deleteTaskWithLinkedTicket,
  deleteTicketWithLinkedTask,
  synchronizeTaskToTicket,
  synchronizeTicketToTask,
} from "@/lib/api/program";
import { insertRow, updateRow } from "@/lib/db/query";
import { withContacts } from "@/lib/partnership/contacts";
import { isRecordDefinitionKey, recordDefinitions, type ManagedField, type RecordDefinition } from "@/lib/records/catalog";
import { revalidatePath } from "next/cache";

function parseField(field: ManagedField, formData: FormData) {
  const value = formData.get(field.name);
  if (field.type === "checkbox") return value === "on";
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (field.type === "money") {
    // "Rp 25.000.000" or "25000000" → 25000000.
    const digits = text.replace(/\D/g, "");
    if (!digits) throw new Error(`${field.label} must be an amount in rupiah.`);
    return Number(digits);
  }
  if (field.type === "number") {
    const number = Number(text);
    if (!Number.isFinite(number)) throw new Error(`${field.label} must be a number.`);
    return number;
  }
  if (field.type === "json") return JSON.parse(text) as unknown;
  if (field.type === "uuid-array") return text.split(",").map((item) => item.trim()).filter(Boolean);
  if (field.type === "text-array") return normalizeNotificationRoles(formData.getAll(field.name));
  return text;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function getDefinition(key: string) {
  if (!isRecordDefinitionKey(key)) throw new Error("Unknown record definition.");
  return recordDefinitions[key] as RecordDefinition;
}

function requireMutationRole(
  definition: ReturnType<typeof getDefinition>,
  user: { role?: string | null },
) {
  if (!definition.mutationRoles?.length) return;
  const role = user.role?.trim().toLowerCase() || "member";
  if (!definition.mutationRoles.includes(role)) {
    throw new Error("You do not have permission to modify this module.");
  }
}

function getValues(key: string, formData: FormData) {
  const definition = getDefinition(key);
  const values = Object.fromEntries(definition.fields.map((field) => [field.name, parseField(field, formData)]));
  // Partners: several PICs in one list; the older one-PIC columns follow the first (Putaran 61).
  return key === "partners" || key === "org_partners" ? withContacts(values) : values;
}

type ManagedRecord = Record<string, unknown> & { id: string };

function getActorName(user: { name?: string | null; email?: string | null }) {
  return user.name || user.email || "CCC User";
}

function getTicketTitle(record: ManagedRecord | null) {
  return typeof record?.title === "string" && record.title.trim() ? record.title.trim() : "Untitled ticket";
}

function getTicketRoles(record: ManagedRecord | null, fallbackRole?: string | null) {
  const roles = normalizeNotificationRoles(record?.notification_roles);
  return roles.length ? roles : [fallbackRole?.trim().toLowerCase() || "admin"];
}

function getActivityDetail(record: ManagedRecord | null) {
  if (!record) return "";
  const value = record.title ?? record.name ?? record.nama ?? record.email ?? record.company ?? record.kode;
  return typeof value === "string" ? value : `ID: ${record.id}`;
}

async function notifyTicket(input: Parameters<typeof publishTicketNotification>[0]) {
  try {
    await publishTicketNotification(input);
  } catch (error) {
    console.error("Ticket notification could not be published", error);
  }
}

/**
 * Links the app keeps itself (Putaran 58): a task's ticket_id and a ticket's requester. Changing
 * them by hand could attach someone else's ticket to a task, or make yourself its requester and
 * see it — so only an admin may, and a ticket keeps its requester otherwise.
 */
function guardSystemLinks(key: string, values: Record<string, unknown>, user: { role?: string | null }, previous: ManagedRecord | null) {
  if (String(user.role || "").toLowerCase() === "admin") return;
  if (key === "tasks" && "ticket_id" in values) delete values.ticket_id;
  if (key === "tickets" && "requester_id" in values) {
    if (previous) values.requester_id = previous.requester_id ?? null; else delete values.requester_id;
  }
}

export async function createManagedRecord(key: string, formData: FormData) {
  return expected(async () => {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  const values = getValues(key, formData);
  guardSystemLinks(key, values, user, null);
  // A field left empty gets its default when the row is added (e.g. a resource is a "link").
  for (const field of definition.fields) if (field.defaultValue !== undefined && (values[field.name] === null || values[field.name] === undefined)) values[field.name] = field.defaultValue;

  // The person who makes the ticket is its requester (the same rule as Add ticket, Putaran 57).
  if (key === "tickets" && !values.requester_id) {
    const requester = findTicketPerson({ userId: user.id, email: user.email }, await listTicketPeople());
    if (requester) values.requester_id = String(requester.id);
  }

  if (key === "tickets" && !normalizeNotificationRoles(values.notification_roles).length) {
    values.notification_roles = [user.role?.trim().toLowerCase() || "admin"];
  }

  const record = await insertRow<ManagedRecord>(definition.table, values);

  if (key === "tasks") {
    await synchronizeTaskToTicket(record.id, user.id);
  } else if (key === "tickets" && record.related_task_id) {
    await synchronizeTicketToTask(record.id);
  }

  if (key === "tickets") {
    const actorName = getActorName(user);
    await notifyTicket({
      ticketId: record.id,
      actorUserId: user.id,
      actorName,
      eventType: "created",
      title: `New ticket: ${getTicketTitle(record)}`,
      message: `${actorName} created this ticket.`,
      targetRoles: getTicketRoles(record, user.role),
      ticket: record,
    });
  }

  await logActivity({
    userName: getActorName(user),
    module: definition.title,
    action: "Tambah",
    detail: getActivityDetail(record),
    table: definition.table,
  });

  revalidatePath(definition.path);
  revalidatePath("/dashboard");
  });
}

export async function updateManagedRecord(key: string, id: string, formData: FormData) {
  return expected(async () => {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  const previous = key === "tickets" ? await requireTicketAccess(user, id) as ManagedRecord : null;
  const values = getValues(key, formData);
  guardSystemLinks(key, values, user, previous);
  // Resources: the page never holds the password, so an empty Password keeps the current one.
  if (key === "resources" && !values.password) delete values.password;
  // A field left empty gets its default when the row is added (e.g. a resource is a "link").
  for (const field of definition.fields) if (field.defaultValue !== undefined && (values[field.name] === null || values[field.name] === undefined)) values[field.name] = field.defaultValue;

  if (key === "tickets" && !normalizeNotificationRoles(values.notification_roles).length) {
    values.notification_roles = getTicketRoles(previous, user.role);
  }

  const record = await updateRow<ManagedRecord>(definition.table, id, values);

  if (key === "tasks" && record) {
    await synchronizeTaskToTicket(record.id, user.id);
  } else if (key === "tickets" && record?.related_task_id) {
    await synchronizeTicketToTask(record.id);
  }

  if (key === "tickets" && record) {
    const actorName = getActorName(user);
    const oldStatus = typeof previous?.status === "string" ? previous.status : null;
    const newStatus = typeof record.status === "string" ? record.status : null;
    const message = oldStatus && newStatus && oldStatus !== newStatus
      ? `${actorName} moved the ticket from ${oldStatus} to ${newStatus}.`
      : `${actorName} updated this ticket.`;

    await notifyTicket({
      ticketId: record.id,
      actorUserId: user.id,
      actorName,
      eventType: "updated",
      title: `Ticket updated: ${getTicketTitle(record)}`,
      message,
      targetRoles: getTicketRoles(record, user.role),
      ticket: record,
    });
  }

  if (record) {
    await logActivity({
      userName: getActorName(user),
      module: definition.title,
      action: "Update",
      detail: getActivityDetail(record),
      table: definition.table,
    });
  }

  revalidatePath(definition.path);
  revalidatePath("/dashboard");
  });
}

/** What a delete would do, for its confirm message: refused (still used) or what goes with it. */
export async function describeDeleteAction(key: string, ids: string[]) {
  return expected(async () => {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  return describeDelete(definition.table, ids.map(String));
  });
}

export async function deleteManagedRecord(key: string, id: string) {
  return expected(async () => {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  const previous = key === "tickets" ? await requireTicketAccess(user, id) as ManagedRecord : null;
  if (key === "tasks") {
    await deleteTaskWithLinkedTicket(id);
  } else if (key === "tickets") {
    await deleteTicketWithLinkedTask(id);
  } else if (key === "events") {
    await deleteProgramEventWithWorkflow(id);
  } else {
    await deleteWithDependents(definition.table, [id]);
  }

  if (key === "tickets" && previous) {
    const actorName = getActorName(user);
    await notifyTicket({
      actorUserId: user.id,
      actorName,
      eventType: "deleted",
      title: `Ticket deleted: ${getTicketTitle(previous)}`,
      message: `${actorName} deleted this ticket.`,
      targetRoles: getTicketRoles(previous, user.role),
      ticket: previous,
    });
  }

  await logActivity({
    userName: getActorName(user),
    module: definition.title,
    action: "Hapus",
    detail: getActivityDetail(previous) || `ID: ${id}`,
    table: definition.table,
  });

  revalidatePath(definition.path);
  revalidatePath("/dashboard");
  });
}
