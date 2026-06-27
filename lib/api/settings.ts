import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type AppSettingRecord = ApiRecord;

const settings = createTableApi<AppSettingRecord>("app_settings", {
  orderBy: "created_at",
  ascending: false,
});

export const listAppSettings = settings.list;
export const countAppSettings = settings.count;
export const getAppSetting = settings.get;
export const createAppSetting = settings.create;
export const updateAppSetting = settings.update;
export const deleteAppSetting = settings.remove;
