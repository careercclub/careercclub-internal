// Generated from app/actions/content-planning-actions.ts — the browser side of every action in it: a failure value
// becomes an Error with its real message again (see lib/actions/expected.ts). Import actions from here
// in client components. Kept in sync by lib/actions/wrappers.test.mjs.
import * as server from "@/app/actions/content-planning-actions";
import { unwrapAction } from "@/lib/actions/unwrap";

export type { CarouselPlanInput, KolInput, MtStoryInput } from "@/app/actions/content-planning-actions";

export const createStoryPlanFromTextAction = unwrapAction(server.createStoryPlanFromTextAction);
export const addStorySlideAction = unwrapAction(server.addStorySlideAction);
export const setStoryPlanStatusAction = unwrapAction(server.setStoryPlanStatusAction);
export const addCarouselPlanLinkAction = unwrapAction(server.addCarouselPlanLinkAction);
export const addContentLinkAction = unwrapAction(server.addContentLinkAction);
export const deleteContentLinkAction = unwrapAction(server.deleteContentLinkAction);
export const createCarouselPlanAction = unwrapAction(server.createCarouselPlanAction);
export const updateCarouselPlanAction = unwrapAction(server.updateCarouselPlanAction);
export const setCarouselStatusAction = unwrapAction(server.setCarouselStatusAction);
export const setCarouselDateAction = unwrapAction(server.setCarouselDateAction);
export const setCarouselLinkBriefAction = unwrapAction(server.setCarouselLinkBriefAction);
export const setCarouselLinkReferensiAction = unwrapAction(server.setCarouselLinkReferensiAction);
export const deleteCarouselPlanAction = unwrapAction(server.deleteCarouselPlanAction);
export const createCtaAction = unwrapAction(server.createCtaAction);
export const createStoryDateAction = unwrapAction(server.createStoryDateAction);
export const deleteStoryDateAction = unwrapAction(server.deleteStoryDateAction);
export const addStoryItemAction = unwrapAction(server.addStoryItemAction);
export const updateStoryItemAction = unwrapAction(server.updateStoryItemAction);
export const deleteStoryItemAction = unwrapAction(server.deleteStoryItemAction);
export const createKolAction = unwrapAction(server.createKolAction);
export const updateKolAction = unwrapAction(server.updateKolAction);
export const deleteKolAction = unwrapAction(server.deleteKolAction);
export const createMtStoryAction = unwrapAction(server.createMtStoryAction);
export const updateMtStoryAction = unwrapAction(server.updateMtStoryAction);
export const deleteMtStoryAction = unwrapAction(server.deleteMtStoryAction);
export const setMtPostedAction = unwrapAction(server.setMtPostedAction);
