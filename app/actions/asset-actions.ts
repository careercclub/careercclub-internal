"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import {
  createContentLibraryItem,
  deleteContentLibraryItem,
  getContentLibraryItem,
  updateContentLibraryItem,
} from "@/lib/api/content-library";
import { createDesignAsset, getDesignAsset } from "@/lib/api/design-assets";
import {
  buildContentLibraryPayload,
  contentLabels,
  resolveEditedImagePaths,
  uploadedImagePaths,
} from "@/lib/content-library/payload";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.name || session.user.email || "CCC User";
}

function contentSummary(row: { platform: string; jenis: string; link: string }) {
  return `${row.platform} ${row.jenis} · ${row.link}`;
}

export async function createDesignAssetAction(input: Record<string, unknown>) {
  await requireUser(); const storagePaths = uploadedImagePaths(input.storage_paths); if (!storagePaths.length) throw new Error("At least one uploaded image is required.");
  await createDesignAsset({ nama: String(input.nama || ""), kategori: String(input.kategori || "Uncategorized"), tipe: String(input.tipe || "assets"), link: String(input.link || ""), notes: String(input.notes || ""), storage_paths: storagePaths, storage_path: storagePaths[0] });
  revalidatePath("/design-assets");
}

export async function createContentLibraryAssetAction(input: Record<string, unknown>) {
  const name = await requireUser();
  const payload = buildContentLibraryPayload(input);
  await createContentLibraryItem({ ...payload, storage_paths: uploadedImagePaths(input.storage_paths) });
  await logActivity({ userName: name, module: "Content Library", action: "Tambah", detail: contentSummary(payload), table: "content_library" });
  revalidatePath("/content-library");
}

export async function updateContentLibraryAssetAction(id: string, input: Record<string, unknown>) {
  const name = await requireUser();
  const current = await getContentLibraryItem(id);
  if (!current) throw new Error("Content not found. It may have been deleted.");
  const payload = buildContentLibraryPayload(input);
  const storagePaths = resolveEditedImagePaths(current.storage_paths, input.kept_storage_paths, input.storage_paths);
  await updateContentLibraryItem(id, { ...payload, storage_paths: storagePaths });
  await logActivity({ userName: name, module: "Content Library", action: "Edit", detail: contentSummary(payload), table: "content_library" });
  revalidatePath("/content-library");
}

export async function deleteContentLibraryAssetAction(id: string) {
  const name = await requireUser();
  const current = await getContentLibraryItem(id);
  if (!current) throw new Error("Content not found. It may have been deleted.");
  await deleteContentLibraryItem(id);
  await logActivity({ userName: name, module: "Content Library", action: "Hapus", detail: contentSummary({ platform: String(current.platform || ""), jenis: String(current.jenis || ""), link: String(current.link || "") }), table: "content_library" });
  revalidatePath("/content-library");
}

export async function sendDesignAssetToLibraryAction(id: string, input: Record<string, unknown>) {
  await requireUser(); const asset = await getDesignAsset(id); if (!asset) throw new Error("Design asset not found.");
  const payload = buildContentLibraryPayload({
    ...input,
    likes: input.likes ?? 0,
    labels: contentLabels(input.labels || asset.kategori),
    link: input.link || asset.link,
    copywriting: input.copywriting || asset.nama,
    notes: input.notes || asset.notes,
  });
  await createContentLibraryItem({ ...payload, storage_paths: Array.isArray(asset.storage_paths) ? asset.storage_paths : asset.storage_path ? [asset.storage_path] : [] });
  revalidatePath("/content-library");
}
