"use server";

import { auth } from "@/auth";
import { createInternalUser, resetInternalUserPassword, updateInternalUserAccess } from "@/lib/api/auth-users";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role?.toLowerCase() !== "admin") throw new Error("Administrator access required.");
}

function password(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value : "";
  if (text.length < 12 || !/[a-z]/i.test(text) || !/\d/.test(text)) throw new Error("Password must be at least 12 characters and include a number.");
  return text;
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "member").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !/^[a-z][a-z0-9_-]{1,30}$/.test(role)) throw new Error("Valid name, email, and role are required.");
  await createInternalUser({ email, name, role, password: password(formData.get("password")) });
  revalidatePath("/settings/users");
}

export async function updateUserAccessAction(id: string, formData: FormData) {
  await requireAdmin();
  const role = String(formData.get("role") || "member").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(role)) throw new Error("Invalid role.");
  await updateInternalUserAccess(id, { role, isActive: formData.get("is_active") === "on" });
  const newPassword = String(formData.get("password") || "");
  if (newPassword) await resetInternalUserPassword(id, password(newPassword));
  revalidatePath("/settings/users");
}
