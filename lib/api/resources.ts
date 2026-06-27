import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

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
