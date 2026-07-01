"use server";

import { auth } from "@/auth";
import { createContentLibraryItem } from "@/lib/api/content-library";
import { createDesignAsset, getDesignAsset } from "@/lib/api/design-assets";
import { revalidatePath } from "next/cache";

async function requireUser() { const session = await auth(); if (!session?.user) throw new Error("Unauthorized"); }
function keys(value: unknown) { return Array.isArray(value) ? value.map(String).filter((key) => key.startsWith("design-assets/")) : []; }

export async function createDesignAssetAction(input: Record<string, unknown>) {
  await requireUser(); const storagePaths = keys(input.storage_paths); if (!storagePaths.length) throw new Error("At least one uploaded image is required.");
  await createDesignAsset({ nama: String(input.nama || ""), kategori: String(input.kategori || "Uncategorized"), tipe: String(input.tipe || "assets"), link: String(input.link || ""), notes: String(input.notes || ""), storage_paths: storagePaths, storage_path: storagePaths[0] });
  revalidatePath("/design-assets");
}

export async function createContentLibraryAssetAction(input: Record<string, unknown>) {
  await requireUser(); const storagePaths = keys(input.storage_paths); if (!storagePaths.length) throw new Error("At least one uploaded image is required.");
  await createContentLibraryItem({ platform: String(input.platform || "Instagram"), jenis: String(input.jenis || "Carousel"), link: String(input.link || ""), copywriting: String(input.copywriting || ""), likes: Number(input.likes || 0), comments: Number(input.comments || 0), shares: Number(input.shares || 0), views: Number(input.views || 0), labels: Array.isArray(input.labels) ? input.labels.map(String) : [], storage_paths: storagePaths, notes: String(input.notes || "") });
  revalidatePath("/content-library");
}

export async function sendDesignAssetToLibraryAction(id: string) {
  await requireUser(); const asset = await getDesignAsset(id); if (!asset) throw new Error("Design asset not found.");
  await createContentLibraryItem({ platform: "Instagram", jenis: "Carousel", link: asset.link || "", copywriting: asset.nama || "", likes: 0, comments: 0, shares: 0, views: 0, labels: asset.kategori ? [String(asset.kategori)] : [], storage_paths: Array.isArray(asset.storage_paths) ? asset.storage_paths : asset.storage_path ? [asset.storage_path] : [], notes: asset.notes || "" });
  revalidatePath("/content-library");
}
