import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type CompetitorProfileRecord = ApiRecord;
export type CompetitorSnapshotRecord = ApiRecord;
export type CompetitorFlagRecord = ApiRecord;
export type CompetitorProductRecord = ApiRecord;
export type CompetitorProductPriceRecord = ApiRecord;

const profiles = createTableApi<CompetitorProfileRecord>("competitor_profiles", {
  orderBy: "name",
  ascending: true,
});

const snapshots = createTableApi<CompetitorSnapshotRecord>("competitor_snapshots", {
  orderBy: "snapshot_date",
  ascending: false,
});

const flags = createTableApi<CompetitorFlagRecord>("competitor_flags", {
  orderBy: "flag_date",
  ascending: false,
});

const products = createTableApi<CompetitorProductRecord>("competitor_products", {
  orderBy: "created_at",
  ascending: false,
});

const prices = createTableApi<CompetitorProductPriceRecord>("competitor_product_prices", {
  orderBy: "recorded_at",
  ascending: false,
});

export const listCompetitorProfiles = profiles.list;
export const countCompetitorProfiles = profiles.count;
export const getCompetitorProfile = profiles.get;
export const createCompetitorProfile = profiles.create;
export const updateCompetitorProfile = profiles.update;
export const deleteCompetitorProfile = profiles.remove;

export const listCompetitorSnapshots = snapshots.list;
export const createCompetitorSnapshot = snapshots.create;
export const updateCompetitorSnapshot = snapshots.update;
export const deleteCompetitorSnapshot = snapshots.remove;

export const listCompetitorFlags = flags.list;
export const createCompetitorFlag = flags.create;
export const updateCompetitorFlag = flags.update;
export const deleteCompetitorFlag = flags.remove;

export const listCompetitorProducts = products.list;
export const createCompetitorProduct = products.create;
export const updateCompetitorProduct = products.update;
export const deleteCompetitorProduct = products.remove;

export const listCompetitorProductPrices = prices.list;
export const createCompetitorProductPrice = prices.create;
export const updateCompetitorProductPrice = prices.update;
export const deleteCompetitorProductPrice = prices.remove;
