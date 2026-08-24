"use server";

import { auth } from "@/auth";
import { createContentLibraryItem } from "@/lib/api/content-library";
import { createDesignAsset, getDesignAsset } from "@/lib/api/design-assets";
import { revalidatePath } from "next/cache";

async function requireUser() { const session = await auth(); if (!session?.user) throw new Error("Unauthorized"); }
function keys(value: unknown) { return Array.isArray(value) ? value.map(String).filter((key) => key.startsWith("design-assets/")) : []; }
function nonNegative(value: unknown, field: string) { const parsed = Number(value || 0); if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} must be zero or greater.`); return parsed; }
function contentType(value: unknown) { return String(value || "").toLowerCase() === "ads" ? "ads" : "organic"; }
function contentLabels(value: unknown) { return (Array.isArray(value) ? value.map(String) : String(value || "").split(",")).map((label) => label.trim()).filter(Boolean); }

export async function createDesignAssetAction(input: Record<string, unknown>) {
  await requireUser(); const storagePaths = keys(input.storage_paths); if (!storagePaths.length) throw new Error("At least one uploaded image is required.");
  await createDesignAsset({ nama: String(input.nama || ""), kategori: String(input.kategori || "Uncategorized"), tipe: String(input.tipe || "assets"), link: String(input.link || ""), notes: String(input.notes || ""), storage_paths: storagePaths, storage_path: storagePaths[0] });
  revalidatePath("/design-assets");
}

export async function createContentLibraryAssetAction(input: Record<string, unknown>) {
  await requireUser();
  const storagePaths = keys(input.storage_paths);
  const link = String(input.link || "").trim();
  const labels = contentLabels(input.labels);
  if (!link) throw new Error("Content link is required.");
  if (input.likes === "" || input.likes === null || input.likes === undefined) throw new Error("Likes are required.");
  if (!labels.length) throw new Error("At least one label is required.");
  await createContentLibraryItem({ tipe: contentType(input.tipe), platform: String(input.platform || "Instagram"), jenis: String(input.jenis || "Carousel"), link, copywriting: String(input.copywriting || ""), likes: nonNegative(input.likes, "Likes"), comments: nonNegative(input.comments, "Comments"), shares: nonNegative(input.shares, "Shares"), views: nonNegative(input.views, "Views"), labels, storage_paths: storagePaths, notes: String(input.notes || "") });
  revalidatePath("/content-library");
}

export async function sendDesignAssetToLibraryAction(id: string, input: Record<string, unknown>) {
  await requireUser(); const asset = await getDesignAsset(id); if (!asset) throw new Error("Design asset not found.");
  const likes = nonNegative(input.likes, "Likes");
  const labels = contentLabels(input.labels || asset.kategori);
  const link = String(input.link || asset.link || "").trim();
  if (!link) throw new Error("Content link is required.");
  if (!labels.length) throw new Error("At least one label is required.");
  await createContentLibraryItem({ tipe: contentType(input.tipe), platform: String(input.platform || "Instagram"), jenis: String(input.jenis || "Carousel"), link, copywriting: String(input.copywriting || asset.nama || ""), likes, comments: nonNegative(input.comments, "Comments"), shares: nonNegative(input.shares, "Shares"), views: nonNegative(input.views, "Views"), labels, storage_paths: Array.isArray(asset.storage_paths) ? asset.storage_paths : asset.storage_path ? [asset.storage_path] : [], notes: String(input.notes || asset.notes || "") });
  revalidatePath("/content-library");
}
