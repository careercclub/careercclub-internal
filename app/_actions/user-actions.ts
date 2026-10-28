// Generated from app/actions/user-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/user-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const createUserAction = unwrapAction(server.createUserAction);
export const updateUserAccessAction = unwrapAction(server.updateUserAccessAction);
