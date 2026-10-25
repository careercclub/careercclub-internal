// Modules that can read a Google Sheet every hour. Shared by the page (browser) and the server;
// no runtime imports.
export const SHEET_SYNC_JOBS = {
  "talent-pool": { settingKey: "talent_pool_sheet_sync", module: "Talent Pool", table: "talent_pool", path: "/talent-pool" },
  "mt-prospects": { settingKey: "mt_prospects_sheet_sync", module: "Job Vacancy MT", table: "mt_prospects", path: "/job-vacancy-mt" },
  "customer-knowledge": { settingKey: "pain_points_sheet_sync", module: "Customer Knowledge", table: "pain_points", path: "/customer-knowledge" },
} as const;
export type SheetSyncJob = keyof typeof SHEET_SYNC_JOBS;
export const isSheetSyncJob = (value: string): value is SheetSyncJob => value in SHEET_SYNC_JOBS;
