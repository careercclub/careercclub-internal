import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type ResourceRecord = ApiRecord;

const resources = createTableApi<ResourceRecord>("resources", {
  orderBy: "kategori",
  ascending: true,
});

export const listResources = resources.list;
export const countResources = resources.count;
export const getResource = resources.get;
export const createResource = resources.create;
export const updateResource = resources.update;
export const deleteResource = resources.remove;

export function reorderResources(rows: Array<{ id: string; kategori: string; urutan: number }>) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    for (const row of rows) {
      await tx`update resources set kategori = ${row.kategori}, urutan = ${row.urutan} where id = ${row.id}`;
    }
  }));
}
