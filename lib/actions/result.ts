// What a server action returns when it could not do the job. Next.js hides the message of an
// error thrown by a server action in production ("An error occurred in the Server Components
// render…"), so expected failures travel back as a value and the browser turns them into an
// Error again (lib/actions/unwrap.ts). No runtime imports: used on both sides.
export type ActionFailure = { __actionError: string };

export function isActionFailure(value: unknown): value is ActionFailure {
  return Boolean(value) && typeof value === "object" && typeof (value as ActionFailure).__actionError === "string";
}

/** The message production shows instead of the real one when an error escapes a server action. */
export const MASKED_ERROR = /An error occurred in the Server Components render|specific message is omitted in production/i;
