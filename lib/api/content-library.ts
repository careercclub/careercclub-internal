import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type ContentLibraryRecord = ApiRecord;

const contentLibrary = createTableApi<ContentLibraryRecord>("content_library", {
  orderBy: "created_at",
  ascending: false,
});

export const listContentLibraryItems = contentLibrary.list;
export const countContentLibraryItems = contentLibrary.count;
export const getContentLibraryItem = contentLibrary.get;
export const createContentLibraryItem = contentLibrary.create;
export const updateContentLibraryItem = contentLibrary.update;
export const deleteContentLibraryItem = contentLibrary.remove;
