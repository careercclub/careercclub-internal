import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type DesignAssetRecord = ApiRecord;

const designAssets = createTableApi<DesignAssetRecord>("design_assets", {
  orderBy: "created_at",
  ascending: false,
});

export const listDesignAssets = designAssets.list;
export const countDesignAssets = designAssets.count;
export const getDesignAsset = designAssets.get;
export const createDesignAsset = designAssets.create;
export const updateDesignAsset = designAssets.update;
export const deleteDesignAsset = designAssets.remove;
