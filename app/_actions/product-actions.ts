// Generated from app/actions/product-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/product-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const duplicateProductAction = unwrapAction(server.duplicateProductAction);
