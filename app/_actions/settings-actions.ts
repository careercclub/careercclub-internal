// Generated from app/actions/settings-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/settings-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const saveMenuVisibilityAction = unwrapAction(server.saveMenuVisibilityAction);
export const saveMenuLabelsAction = unwrapAction(server.saveMenuLabelsAction);
export const saveCompetitorIntelListsAction = unwrapAction(server.saveCompetitorIntelListsAction);
export const markErrorFixedAction = unwrapAction(server.markErrorFixedAction);
