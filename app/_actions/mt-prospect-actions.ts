// Generated from app/actions/mt-prospect-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/mt-prospect-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const saveProspectAction = unwrapAction(server.saveProspectAction);
export const deleteProspectAction = unwrapAction(server.deleteProspectAction);
export const saveProspectContactAction = unwrapAction(server.saveProspectContactAction);
export const deleteProspectContactAction = unwrapAction(server.deleteProspectContactAction);
export const loadProspectResearchAction = unwrapAction(server.loadProspectResearchAction);
