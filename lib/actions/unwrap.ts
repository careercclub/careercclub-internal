import { isActionFailure, type ActionFailure } from "./result";

/** Browser side of lib/actions/expected.ts: a failure value becomes an Error with its message again. */
export function unwrapAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<Exclude<R, ActionFailure>> => {
    const result = await action(...args);
    if (isActionFailure(result)) throw new Error(result.__actionError);
    return result as Exclude<R, ActionFailure>;
  };
}
