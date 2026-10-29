// Pure helpers for lib/monitoring/errors.ts (tested under node --test).

export type ErrorKind = "page" | "api" | "action" | "job";

/** Emails and long numbers are masked: an error message must not become a copy of someone's data. */
export function maskMessage(text: string) {
  return String(text || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** One row per kind of error: ids, numbers and quoted values do not make a new one. */
export function errorFingerprint(kind: string, place: string, message: string) {
  const shape = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "#")
    .replace(/"[^"]*"|'[^']*'/g, "\"…\"")
    .replace(/\d+/g, "#")
    .toLowerCase();
  return `${kind}|${place.toLowerCase()}|${shape}`.slice(0, 600);
}

/** The action a stack trace comes from ("updateTicketDetailsAction"), for the Errors list. */
export function actionName(stack: string | undefined) {
  const match = /at (?:async )?(?:Object\.)?(\w+(?:Action|Record|Records))\b/.exec(stack || "");
  return match ? match[1] : "server action";
}
