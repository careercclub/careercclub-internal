import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type OrgPartnerRecord = ApiRecord;
export type OrgDealRecord = ApiRecord;
export type OrgOutreachRecord = ApiRecord;

const orgPartners = createTableApi<OrgPartnerRecord>("org_partners", {
  orderBy: "name",
  ascending: true,
});

const deals = createTableApi<OrgDealRecord>("org_deals", {
  orderBy: "created_at",
  ascending: false,
});

const outreach = createTableApi<OrgOutreachRecord>("org_outreach", {
  orderBy: "created_at",
  ascending: false,
});

export const listOrgPartners = orgPartners.list;
export const countOrgPartners = orgPartners.count;
export const getOrgPartner = orgPartners.get;
export const createOrgPartner = orgPartners.create;
export const updateOrgPartner = orgPartners.update;
export const deleteOrgPartner = orgPartners.remove;

export const listOrgDeals = deals.list;
export const createOrgDeal = deals.create;
export const updateOrgDeal = deals.update;
export const deleteOrgDeal = deals.remove;

export const listOrgOutreach = outreach.list;
export const createOrgOutreach = outreach.create;
export const updateOrgOutreach = outreach.update;
export const deleteOrgOutreach = outreach.remove;
