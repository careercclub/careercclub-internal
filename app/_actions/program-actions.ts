// Generated from app/actions/program-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/program-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const duplicateProgramAction = unwrapAction(server.duplicateProgramAction);
export const repairProgramTicketLinksAction = unwrapAction(server.repairProgramTicketLinksAction);
export const updateProgramTaskWorkflowAction = unwrapAction(server.updateProgramTaskWorkflowAction);
export const updateTaskDetailsAction = unwrapAction(server.updateTaskDetailsAction);
export const createEventAction = unwrapAction(server.createEventAction);
export const createTaskAction = unwrapAction(server.createTaskAction);
export const updateEventAction = unwrapAction(server.updateEventAction);
export const deleteTaskAction = unwrapAction(server.deleteTaskAction);
export const addEventLinkAction = unwrapAction(server.addEventLinkAction);
export const deleteEventLinkAction = unwrapAction(server.deleteEventLinkAction);
export const createRundownRowAction = unwrapAction(server.createRundownRowAction);
export const saveRundownRowAction = unwrapAction(server.saveRundownRowAction);
export const deleteRundownRowAction = unwrapAction(server.deleteRundownRowAction);
export const moveRundownRowAction = unwrapAction(server.moveRundownRowAction);
