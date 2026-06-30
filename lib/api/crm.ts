import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

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

export function countUniqueSuccessfulBuyers() {
  return withPostgres(async (sql) => {
    const [row] = await sql<{ count: string }[]>`
      select count(distinct coalesce(
        nullif(ccc_normalize_wa(wa), ''),
        nullif(lower(btrim(email)), ''),
        id::text
      ))::text as count
      from buyers
      where upper(coalesce(payment_status, '')) = 'SUCCESS'
    `;

    return Number(row?.count || 0);
  });
}

export function listBuyersWithTalentMatches() {
  return withPostgres(async (sql) => {
    const rows = await sql<(BuyerRecord & { talent_pool_match: boolean })[]>`
      select b.*,
        exists (
          select 1
          from talent_pool t
          where (
            ccc_normalize_wa(b.wa) <> ''
            and ccc_normalize_wa(t.wa) = ccc_normalize_wa(b.wa)
          ) or (
            btrim(coalesce(b.email, '')) <> ''
            and lower(btrim(t.email)) = lower(btrim(b.email))
          )
        ) as talent_pool_match
      from buyers b
      order by b.created_at desc
    `;

    return [...rows];
  });
}
