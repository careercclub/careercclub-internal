"use server";

import { auth } from "@/auth";
import { normalizeNotificationRoles, publishTicketNotification } from "@/lib/api/notifications";
import { deleteTicketWithLinkedTask, synchronizeTicketToTask } from "@/lib/api/program";
import { appendTicketComment, appendTicketFile, appendTicketLink, duplicateTicket, getTicket, updateTicket } from "@/lib/api/tickets";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function roles(ticket: Record<string, unknown>) {
  const result = normalizeNotificationRoles(ticket.notification_roles);
  return result.length ? result : ["admin"];
}

async function notify(ticket: Record<string, unknown>, user: Awaited<ReturnType<typeof requireUser>>, message: string) {
  await publishTicketNotification({ ticketId: String(ticket.id), actorUserId: user.id, actorName: user.name || user.email || "CCC User", eventType: "updated", title: `Ticket updated: ${String(ticket.title || "Untitled")}`, message, targetRoles: roles(ticket) });
}

function refresh() {
  revalidatePath("/tickets");
  revalidatePath("/program/tasks");
  revalidatePath("/dashboard");
}

export async function changeTicketStatusAction(id: string, status: string) {
  const user = await requireUser();
  if (!["Todo", "In Progress", "Done"].includes(status)) throw new Error("Invalid ticket status.");
  const ticket = await updateTicket(id, { status });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.related_task_id) await synchronizeTicketToTask(id);
  await notify(ticket, user, `${user.name || user.email} moved the ticket to ${status}.`);
  refresh();
}

export async function addTicketCommentAction(id: string, formData: FormData) {
  const user = await requireUser();
  const text = String(formData.get("comment") || "").trim().slice(0, 5000);
  if (!text) throw new Error("Comment cannot be empty.");
  const ticket = await appendTicketComment(id, { user: user.name || user.email || "CCC User", time: new Date().toISOString(), text });
  if (!ticket) throw new Error("Ticket not found.");
  await notify(ticket, user, `${user.name || user.email} added a comment.`);
  refresh();
}

export async function addTicketLinkAction(id: string, formData: FormData) {
  await requireUser();
  const label = String(formData.get("label") || "Link").trim().slice(0, 100);
  const url = String(formData.get("url") || "").trim();
  try { new URL(url); } catch { throw new Error("A valid URL is required."); }
  await appendTicketLink(id, { label, url });
  refresh();
}

export async function attachTicketFileAction(id: string, file: { name: string; key: string; type: string; size: number }) {
  await requireUser();
  if (!file.key.startsWith("task-attachments/") || file.name.length > 255 || file.size > 10 * 1024 * 1024) throw new Error("Invalid attachment.");
  await appendTicketFile(id, file);
  refresh();
}

export async function duplicateTicketAction(id: string) {
  await requireUser();
  await duplicateTicket(id);
  refresh();
}

export async function updateTicketDetailsAction(id: string, input: Record<string, unknown>) {
  const user = await requireUser();
  const status = String(input.status || "Todo"); const priority = String(input.priority || "Med");
  if (!["Todo", "In Progress", "Done"].includes(status)) throw new Error("Invalid ticket status.");
  if (!["High", "Med", "Low"].includes(priority)) throw new Error("Invalid ticket priority.");
  const assigned = Array.isArray(input.assignedToIds) ? input.assignedToIds.map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)) : [];
  const cc = String(input.cc || "").split(",").map((email) => email.trim()).filter(Boolean).slice(0, 30);
  const ticket = await updateTicket(id, { title: String(input.title || "").trim(), description: String(input.description || "").trim(), status, priority, divisi_id: input.divisionId || null, type_id: input.typeId || null, due_date: input.dueDate || null, assigned_to_id: assigned[0] || null, assigned_to_ids: assigned, cc });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.related_task_id) await synchronizeTicketToTask(id);
  await notify(ticket, user, `${user.name || user.email} updated the ticket details.`);
  refresh();
  return ticket;
}

export async function deleteTicketAction(id: string) {
  await requireUser();
  await deleteTicketWithLinkedTask(id);
  refresh();
}
