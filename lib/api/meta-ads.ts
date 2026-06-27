import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type MetaAdsContentRecord = ApiRecord;

const adsContents = createTableApi<MetaAdsContentRecord>("ads_contents", {
  orderBy: "created_at",
  ascending: false,
});

export const listAdsContents = adsContents.list;
export const countAdsContents = adsContents.count;
export const getAdsContent = adsContents.get;
export const createAdsContent = adsContents.create;
export const updateAdsContent = adsContents.update;
export const deleteAdsContent = adsContents.remove;
