import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type ProgramEventRecord = ApiRecord;
export type ProgramTaskRecord = ApiRecord;
export type EventLinkTemplateRecord = ApiRecord;
export type EventRundownRecord = ApiRecord;

const events = createTableApi<ProgramEventRecord>("events", {
  orderBy: "tanggal",
  ascending: false,
});

const tasks = createTableApi<ProgramTaskRecord>("tasks", {
  orderBy: "created_at",
  ascending: false,
});

const eventLinkTemplates = createTableApi<EventLinkTemplateRecord>("event_link_templates", {
  orderBy: "urutan",
  ascending: true,
});

const eventRundown = createTableApi<EventRundownRecord>("event_rundown", {
  orderBy: "urutan",
  ascending: true,
});

export const listProgramEvents = events.list;
export const countProgramEvents = events.count;
export const getProgramEvent = events.get;
export const createProgramEvent = events.create;
export const updateProgramEvent = events.update;
export const deleteProgramEvent = events.remove;

export const listProgramTasks = tasks.list;
export const countProgramTasks = tasks.count;
export const getProgramTask = tasks.get;
export const createProgramTask = tasks.create;
export const updateProgramTask = tasks.update;
export const deleteProgramTask = tasks.remove;

export const listEventLinkTemplates = eventLinkTemplates.list;
export const createEventLinkTemplate = eventLinkTemplates.create;
export const updateEventLinkTemplate = eventLinkTemplates.update;
export const deleteEventLinkTemplate = eventLinkTemplates.remove;

export const listEventRundown = eventRundown.list;
export const createEventRundownItem = eventRundown.create;
export const updateEventRundownItem = eventRundown.update;
export const deleteEventRundownItem = eventRundown.remove;

type WorkflowRecord = {
  id: string;
  nama?: string | null;
  jenis_program?: string | null;
  tanggal?: string | null;
  waktu?: string | null;
  status?: string | null;
  description?: string | null;
  deskripsi?: string | null;
  title?: string | null;
  priority?: string | null;
  phase?: string | null;
  project_id?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
  assignee_ids?: string[] | null;
  assigned_to_id?: string | null;
  assigned_to_ids?: string[] | null;
  divisi_id?: string | null;
  ticket_id?: string | null;
  related_task_id?: string | null;
  speaker?: string | null;
  platform?: string | null;
  target?: number | null;
  links?: unknown[] | null;
  event_name?: string | null;
};

const taskToTicketStatus: Record<string, string> = {
  Todo: "Open",
  "On Progress": "In Progress",
  "In Progress": "In Progress",
  Done: "Done",
  Blocked: "Done",
};

const ticketToTaskStatus: Record<string, string> = {
  Open: "Todo",
  "In Review": "In Progress",
  "In Progress": "In Progress",
  Done: "Done",
  Rejected: "Todo",
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function synchronizeTaskToTicket(taskId: string, requesterId?: string | null) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [task] = await tx<(WorkflowRecord & { event_name?: string | null })[]>`
      select tasks.*, events.nama as event_name
      from tasks
      left join events on events.id = tasks.project_id
      where tasks.id = ${taskId}
      for update of tasks
    `;
    if (!task) throw new Error("Task not found.");

    const assigneeIds = ids(task.assignee_ids);
    const primaryAssignee = assigneeIds[0] || text(task.assignee_id) || null;
    let person: WorkflowRecord | undefined;
    if (primaryAssignee) {
      [person] = await tx<WorkflowRecord[]>`select * from tkt_people where id = ${primaryAssignee} limit 1`;
    }
    const divisionId = text(person?.divisi_id) || null;
    let requestType: WorkflowRecord | undefined;
    if (divisionId) {
      [requestType] = await tx<WorkflowRecord[]>`select * from tkt_types where divisi_id = ${divisionId} order by nama limit 1`;
    }

    const eventName = text(task.event_name);
    const eventInfo = eventName
      ? `\n\nEvent: ${eventName}\nDeadline: ${text(task.due_date) || "-"}\nPhase: ${text(task.phase) || "-"}`
      : "";
    const ticketTitle = text(task.title);
    const ticketDescription = `${text(task.description)}${eventInfo}`;
    const ticketStatus = taskToTicketStatus[text(task.status)] || "Open";
    const ticketPriority = text(task.priority) || "Med";
    const ticketAssignees = assigneeIds.length ? assigneeIds : primaryAssignee ? [primaryAssignee] : [];

    const [existing] = await tx<WorkflowRecord[]>`
      select * from tickets
      where id = ${task.ticket_id || null} or related_task_id = ${task.id}
      order by case when id = ${task.ticket_id || null} then 0 else 1 end
      limit 1
      for update
    `;

    if (existing) {
      const [ticket] = await tx<WorkflowRecord[]>`
        update tickets
        set title = ${ticketTitle},
            description = ${ticketDescription},
            status = ${ticketStatus},
            priority = ${ticketPriority},
            type_id = ${requestType?.id || null},
            divisi_id = ${divisionId},
            assigned_to_id = ${primaryAssignee},
            assigned_to_ids = ${ticketAssignees}::uuid[],
            requester_id = ${requesterId || primaryAssignee},
            due_date = ${task.due_date || null},
            related_task_id = ${task.id},
            source = 'Webinar Project'
        where id = ${existing.id}
        returning *
      `;
      if (task.ticket_id !== ticket.id) {
        await tx`update tasks set ticket_id = ${ticket.id} where id = ${task.id}`;
      }
      return ticket;
    }

    await tx`select pg_advisory_xact_lock(hashtext('ccc_ops_ticket_number'))`;
    const [numberRow] = await tx<{ next_number: number }[]>`
      select coalesce(max(nullif(regexp_replace(ticket_no, '\\D', '', 'g'), '')::integer), 0) + 1 as next_number
      from tickets
    `;
    const ticketNo = `TKT-${String(numberRow?.next_number || 1).padStart(3, "0")}`;
    const [ticket] = await tx<WorkflowRecord[]>`
      insert into tickets (
        ticket_no, title, description, status, priority, type_id, divisi_id,
        assigned_to_id, assigned_to_ids, requester_id, due_date, related_task_id,
        source, attachments, cc, links, files, komentar
      ) values (
        ${ticketNo}, ${ticketTitle}, ${ticketDescription}, ${ticketStatus}, ${ticketPriority},
        ${requestType?.id || null}, ${divisionId}, ${primaryAssignee}, ${ticketAssignees}::uuid[],
        ${requesterId || primaryAssignee}, ${task.due_date || null}, ${task.id},
        'Webinar Project', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
      )
      returning *
    `;
    await tx`update tasks set ticket_id = ${ticket.id} where id = ${task.id}`;
    return ticket;
  }));
}

export function synchronizeTicketToTask(ticketId: string) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [ticket] = await tx<WorkflowRecord[]>`select * from tickets where id = ${ticketId} for update`;
    if (!ticket) throw new Error("Ticket not found.");
    if (!ticket.related_task_id) return null;

    const assigneeIds = ids(ticket.assigned_to_ids);
    const primaryAssignee = assigneeIds[0] || text(ticket.assigned_to_id) || null;
    const description = text(ticket.description).split("\n\nEvent:")[0];
    const [task] = await tx<WorkflowRecord[]>`
      update tasks
      set title = ${text(ticket.title)},
          description = ${description},
          status = ${ticketToTaskStatus[text(ticket.status)] || "Todo"},
          priority = ${text(ticket.priority) || "Med"},
          assignee_id = ${primaryAssignee},
          assignee_ids = ${assigneeIds.length ? assigneeIds : primaryAssignee ? [primaryAssignee] : []},
          due_date = ${ticket.due_date || null},
          ticket_id = ${ticket.id}
      where id = ${ticket.related_task_id}
      returning *
    `;
    return task || null;
  }));
}

export function repairTaskTicketLinks(requesterId?: string | null) {
  return withPostgres(async (sql) => {
    const tasksToRepair = await sql<{ id: string }[]>`
      select tasks.id
      from tasks
      left join tickets on tickets.id = tasks.ticket_id
      where tasks.project_id is not null
        and (tasks.ticket_id is null or tickets.id is null)
      order by tasks.created_at
    `;
    let repaired = 0;
    for (const task of tasksToRepair) {
      await synchronizeTaskToTicket(task.id, requesterId);
      repaired += 1;
    }
    await sql`
      update tickets
      set related_task_id = null
      where related_task_id is not null
        and not exists (select 1 from tasks where tasks.id = tickets.related_task_id)
    `;
    return repaired;
  });
}

export function duplicateProgramEvent(input: {
  eventId: string;
  name: string;
  date: string;
  taskIds?: string[];
}) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [event] = await tx<WorkflowRecord[]>`select * from events where id = ${input.eventId}`;
    if (!event) throw new Error("Program event not found.");

    const [created] = await tx<WorkflowRecord[]>`
      insert into events (
        nama, jenis_program, tanggal, waktu, status, deskripsi, speaker,
        platform, link_zoom, target, capaian_peserta, notes_post, links
      ) values (
        ${input.name}, ${event.jenis_program || null}, ${input.date}, ${event.waktu || null},
        'Planning', ${event.deskripsi || null}, ${event.speaker || null}, ${event.platform || null},
        null, ${event.target || 0}, null, null, ${JSON.stringify(event.links || [])}::jsonb
      )
      returning *
    `;

    const selected = input.taskIds?.length ? input.taskIds : null;
    const sourceTasks = selected
      ? await tx<WorkflowRecord[]>`select * from tasks where project_id = ${event.id} and id = any(${selected}) order by created_at`
      : await tx<WorkflowRecord[]>`select * from tasks where project_id = ${event.id} order by created_at`;

    for (const task of sourceTasks) {
      await tx`
        insert into tasks (
          project_id, title, description, status, priority, phase, assignee_id,
          assignee_ids, due_date, ticket_id, gcal_added, attachments
        ) values (
          ${created.id}, ${task.title || ""}, ${task.description || null}, 'Todo',
          ${task.priority || "Med"}, ${task.phase || "Pre Event"}, null,
          '{}'::uuid[], null, null, false, '[]'::jsonb
        )
      `;
    }
    return { event: created, duplicatedTasks: sourceTasks.length };
  }));
}

export function deleteTaskWithLinkedTicket(taskId: string) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [task] = await tx<WorkflowRecord[]>`select * from tasks where id = ${taskId} for update`;
    if (!task) return false;
    await tx`update tasks set ticket_id = null where id = ${task.id}`;
    await tx`update tickets set related_task_id = null where related_task_id = ${task.id}`;
    await tx`
      delete from tickets
      where id = ${task.ticket_id || null}
    `;
    await tx`delete from tasks where id = ${task.id}`;
    return true;
  }));
}

export function deleteTicketWithLinkedTask(ticketId: string) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const [ticket] = await tx<WorkflowRecord[]>`select * from tickets where id = ${ticketId} for update`;
    if (!ticket) return false;
    await tx`update tickets set related_task_id = null where id = ${ticket.id}`;
    await tx`update tasks set ticket_id = null where ticket_id = ${ticket.id}`;
    if (ticket.related_task_id) {
      await tx`delete from tasks where id = ${ticket.related_task_id}`;
    } else {
      await tx`delete from tasks where ticket_id = ${ticket.id}`;
    }
    await tx`delete from tickets where id = ${ticket.id}`;
    return true;
  }));
}

export function deleteProgramEventWithWorkflow(eventId: string) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const taskRows = await tx<{ id: string; ticket_id: string | null }[]>`
      select id, ticket_id from tasks where project_id = ${eventId} for update
    `;
    const taskIds = taskRows.map((task) => task.id);
    const ticketIds = taskRows.map((task) => task.ticket_id).filter((id): id is string => Boolean(id));
    if (taskIds.length || ticketIds.length) {
      await tx`update tasks set ticket_id = null where id = any(${taskIds}::uuid[])`;
      await tx`update tickets set related_task_id = null where related_task_id = any(${taskIds}::uuid[])`;
      await tx`
        delete from tickets
        where id = any(${ticketIds}::uuid[])
      `;
      await tx`delete from tasks where id = any(${taskIds}::uuid[])`;
    }
    const result = await tx`delete from events where id = ${eventId}`;
    return (result.count || 0) > 0;
  }));
}
