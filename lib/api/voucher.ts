import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

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
