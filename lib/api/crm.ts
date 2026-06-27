import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type BuyerRecord = ApiRecord;
export type CrmDealRecord = ApiRecord;

const buyers = createTableApi<BuyerRecord>("buyers", {
  orderBy: "created_at",
  ascending: false,
});

const deals = createTableApi<CrmDealRecord>("crm_deals", {
  orderBy: "created_at",
  ascending: false,
});

export const listBuyers = buyers.list;
export const countBuyers = buyers.count;
export const getBuyer = buyers.get;
export const createBuyer = buyers.create;
export const updateBuyer = buyers.update;
export const deleteBuyer = buyers.remove;

export const listCrmDeals = deals.list;
export const countCrmDeals = deals.count;
export const getCrmDeal = deals.get;
export const createCrmDeal = deals.create;
export const updateCrmDeal = deals.update;
export const deleteCrmDeal = deals.remove;
