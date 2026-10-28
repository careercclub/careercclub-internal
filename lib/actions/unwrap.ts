import { isActionFailure, type ActionFailure } from "./result";

/** Browser side of lib/actions/expected.ts: a failure value becomes an Error with its message again. */
export const OFFLINE_MESSAGE = "You’re offline, so this was not saved. Try again when you’re back online.";

export function unwrapAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<Exclude<R, ActionFailure>> => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error(OFFLINE_MESSAGE);
    let result: R;
    try {
      result = await action(...args);
    } catch (error) {
      // The request never reached the server (connection dropped on the way).
      if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) throw new Error(OFFLINE_MESSAGE);
      throw error;
    }
    if (isActionFailure(result)) throw new Error(result.__actionError);
    return result as Exclude<R, ActionFailure>;
  };
}
