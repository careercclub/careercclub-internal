"use server";

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
import { deleteRow, getRowById, insertRow, updateRow } from "@/lib/db/query";
import { isRecordDefinitionKey, recordDefinitions, type ManagedField, type RecordDefinition } from "@/lib/records/catalog";
import { revalidatePath } from "next/cache";

function parseField(field: ManagedField, formData: FormData) {
  const value = formData.get(field.name);
  if (field.type === "checkbox") return value === "on";
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
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
  return Object.fromEntries(definition.fields.map((field) => [field.name, parseField(field, formData)]));
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

export async function createManagedRecord(key: string, formData: FormData) {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  const values = getValues(key, formData);

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
}

export async function updateManagedRecord(key: string, id: string, formData: FormData) {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  const previous = key === "tickets" ? await getRowById<ManagedRecord>(definition.table, id) : null;
  const values = getValues(key, formData);

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
}

export async function deleteManagedRecord(key: string, id: string) {
  const user = await requireUser();
  const definition = getDefinition(key);
  requireMutationRole(definition, user);
  const previous = key === "tickets" ? await getRowById<ManagedRecord>(definition.table, id) : null;
  if (key === "tasks") {
    await deleteTaskWithLinkedTicket(id);
  } else if (key === "tickets") {
    await deleteTicketWithLinkedTask(id);
  } else if (key === "events") {
    await deleteProgramEventWithWorkflow(id);
  } else {
    await deleteRow(definition.table, id);
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
}
