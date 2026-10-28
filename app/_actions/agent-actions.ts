// Generated from app/actions/agent-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/agent-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const createAgentKeyAction = unwrapAction(server.createAgentKeyAction);
export const revokeAgentKeyAction = unwrapAction(server.revokeAgentKeyAction);
