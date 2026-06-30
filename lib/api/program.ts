import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

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
