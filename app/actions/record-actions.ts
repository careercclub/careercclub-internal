"use server";

import { expected } from "@/lib/actions/expected";
import { requireTicketAccess } from "@/lib/tickets/access";
import { deleteWithDependents, describeDelete } from "@/lib/records/delete";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import {
  deleteProgramEventWithWorkflow,
  deleteTaskWithLinkedTicket,
  deleteTicketWithLinkedTask,
} from "@/lib/api/program";
import { createRecord, getActorName, getActivityDetail, getDefinition, getTicketRoles, getTicketTitle, notifyTicket, requireMutationRole, updateRecord, type ManagedRecord } from "@/lib/records/write";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createManagedRecord(key: string, formData: FormData) {
  return expected(async () => {
  await createRecord(await requireUser(), key, formData);
  });
}

export async function updateManagedRecord(key: string, id: string, formData: FormData) {
  return expected(async () => {
  await updateRecord(await requireUser(), key, id, formData);
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
