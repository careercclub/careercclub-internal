import "server-only";
import { unstable_rethrow } from "next/navigation";
import { failureMessage, GENERIC } from "./messages";
import type { ActionFailure } from "./result";

// Every server action runs its body through `expected` (app/actions/*.ts). A failure comes back as
// { __actionError: "a sentence the person can act on" } instead of a thrown error, whose message
// production would hide. Redirects and notFound() still work.

export async function expected<T>(run: () => Promise<T>): Promise<T | ActionFailure> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);
    const message = failureMessage(error);
    if (!message) console.error("[server action] failed", error);
    return { __actionError: message || GENERIC };
  }
}
