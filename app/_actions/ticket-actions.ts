// Generated from app/actions/ticket-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/ticket-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const changeTicketStatusAction = unwrapAction(server.changeTicketStatusAction);
export const addTicketCommentAction = unwrapAction(server.addTicketCommentAction);
export const addTicketLinkAction = unwrapAction(server.addTicketLinkAction);
export const removeTicketLinkAction = unwrapAction(server.removeTicketLinkAction);
export const attachTicketFileAction = unwrapAction(server.attachTicketFileAction);
export const duplicateTicketAction = unwrapAction(server.duplicateTicketAction);
export const updateTicketDetailsAction = unwrapAction(server.updateTicketDetailsAction);
export const deleteTicketAction = unwrapAction(server.deleteTicketAction);
export const createTicketAction = unwrapAction(server.createTicketAction);
