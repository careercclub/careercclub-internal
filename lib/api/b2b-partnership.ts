import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type PartnerRecord = ApiRecord;
export type PartnerDealRecord = ApiRecord;
export type PartnerOutreachRecord = ApiRecord;

const partners = createTableApi<PartnerRecord>("partners", {
  orderBy: "name",
  ascending: true,
});

const deals = createTableApi<PartnerDealRecord>("partner_deals", {
  orderBy: "created_at",
  ascending: false,
});

const outreach = createTableApi<PartnerOutreachRecord>("partner_outreach", {
  orderBy: "created_at",
  ascending: false,
});

export const listPartners = partners.list;
export const countPartners = partners.count;
export const getPartner = partners.get;
export const createPartner = partners.create;
export const updatePartner = partners.update;
export const deletePartner = partners.remove;

export const listPartnerDeals = deals.list;
export const createPartnerDeal = deals.create;
export const updatePartnerDeal = deals.update;
export const deletePartnerDeal = deals.remove;

export const listPartnerOutreach = outreach.list;
export const createPartnerOutreach = outreach.create;
export const updatePartnerOutreach = outreach.update;
export const deletePartnerOutreach = outreach.remove;
