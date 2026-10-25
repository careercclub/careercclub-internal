"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { createAgentToken, revokeAgentToken } from "@/lib/api/agent-tokens";
import { isAgentModule } from "@/lib/agent/modules";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role?.toLowerCase() !== "admin") throw new Error("Administrator access required.");
  return session.user.name || session.user.email || "Admin";
}

/** Makes a Claude access key. The key is returned once, to show it; only its hash is kept. */
export async function createAgentKeyAction(input: { name: string; modules: string[] }) {
  const admin = await requireAdmin();
  const name = String(input.name || "").trim().slice(0, 60);
  const modules = [...new Set((input.modules || []).filter(isAgentModule))];
  if (!name) throw new Error("Give the key a name.");
  if (!modules.length) throw new Error("Choose at least one module.");
  const created = await createAgentToken({ name, modules, createdBy: admin });
  await logActivity({ userName: admin, module: "Settings", action: "Add Claude access key", detail: `${name} · ${modules.join(", ")}` });
  revalidatePath("/settings");
  return created;
}

export async function revokeAgentKeyAction(id: string, name: string) {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown key.");
  await revokeAgentToken(id);
  await logActivity({ userName: admin, module: "Settings", action: "Revoke Claude access key", detail: name.slice(0, 60) });
  revalidatePath("/settings");
}
