// Generated from app/actions/asset-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/asset-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export const createDesignAssetAction = unwrapAction(server.createDesignAssetAction);
export const createContentLibraryAssetAction = unwrapAction(server.createContentLibraryAssetAction);
export const updateContentLibraryAssetAction = unwrapAction(server.updateContentLibraryAssetAction);
export const deleteContentLibraryAssetAction = unwrapAction(server.deleteContentLibraryAssetAction);
export const sendDesignAssetToLibraryAction = unwrapAction(server.sendDesignAssetToLibraryAction);
