"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { withPostgres } from "@/lib/db/postgres";
import { revalidatePath } from "next/cache";

function validIds(ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 1000);
  if (!unique.length || unique.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Invalid buyer selection.");
  return unique;
}

export async function bulkUpdateCrmBuyers(ids: string[], operation: "status" | "talent" | "delete", value?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const selected = validIds(ids);
  await withPostgres(async (sql) => sql.begin(async (tx) => {
    if (operation === "status") {
      const allowed = ["Belum diblast", "Diblast", "Sedang di-upsell", "Sedang di-downsell", "Sedang di-cross sell", "Sudah convert — Upsell", "Sudah convert — Downsell", "Sudah convert — Cross sell"];
      if (!value || !allowed.includes(value)) throw new Error("Invalid CRM status.");
      await tx`update buyers set status = ${value} where id = any(${selected}::uuid[])`;
    } else if (operation === "talent") {
      await tx`update buyers set talent_pool = true where id = any(${selected}::uuid[])`;
    } else {
      await tx`delete from buyers where id = any(${selected}::uuid[])`;
    }
  }));
  await logActivity({ userName: session.user.name || session.user.email || "CCC User", module: "CRM", action: operation === "delete" ? "Hapus" : "Update", detail: `${selected.length} buyer records`, table: "buyers" });
  revalidatePath("/crm");
  revalidatePath("/dashboard");
}
