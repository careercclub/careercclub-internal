import "server-only";
import type { Row } from "postgres";
import {
  countRows,
  deleteRow,
  getRowById,
  insertRow,
  listRows,
  type QueryOptions,
  updateRow,
} from "@/lib/db/query";
import type { TableName } from "@/lib/db/tables";

export type ApiRecord = Row & {
  id: string;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type ApiInput = Record<string, unknown>;

export function createTableApi<TRecord extends ApiRecord>(
  table: TableName,
  defaults: QueryOptions = {},
) {
  return {
    list(options: QueryOptions = {}) {
      return listRows<TRecord>(table, { ...defaults, ...options });
    },
    count(options: Pick<QueryOptions, "eq"> = {}) {
      return countRows(table, options);
    },
    get(id: string) {
      return getRowById<TRecord>(table, id);
    },
    create(values: ApiInput) {
      return insertRow<TRecord>(table, values);
    },
    update(id: string, values: ApiInput) {
      return updateRow<TRecord>(table, id, values);
    },
    remove(id: string) {
      return deleteRow(table, id);
    },
  };
}
