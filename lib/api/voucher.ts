import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type VoucherRecord = ApiRecord;

const vouchers = createTableApi<VoucherRecord>("vouchers", {
  orderBy: "created_at",
  ascending: false,
});

export const listVouchers = vouchers.list;
export const countVouchers = vouchers.count;
export const getVoucher = vouchers.get;
export const createVoucher = vouchers.create;
export const updateVoucher = vouchers.update;
export const deleteVoucher = vouchers.remove;

export function incrementVoucherUsage(id: string, amount: number) {
  return withPostgres(async (sql) => {
    const [row] = await sql<VoucherRecord[]>`
      update vouchers
      set terpakai = greatest(0, least(coalesce(kuota, 2147483647), coalesce(terpakai, 0) + ${amount}))
      where id = ${id}
      returning *
    `;
    return row || null;
  });
}
