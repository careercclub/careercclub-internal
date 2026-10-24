"use server";

import { auth } from "@/auth";
import { getContentEvaluation } from "@/lib/api/content-evaluation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The full evaluation for the editor (the page list leaves out edit-only columns). */
export async function loadContentEvaluationAction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!UUID.test(id)) throw new Error("Unknown evaluation.");
  const row = await getContentEvaluation(id);
  if (!row) throw new Error("This evaluation no longer exists.");
  return row;
}
