"use client";

import { useEffect } from "react";
import s from "./loading.module.css";

// Safety net for anything a module did not catch: the menu and top bar stay usable and
// the person gets a way forward instead of a blank screen.
export default function ModuleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Module error", error); }, [error]);
  return (
    <div className={s.errorBox} role="alert">
      <i className="ti ti-alert-triangle" aria-hidden="true" />
      <h1>This page hit a problem</h1>
      <p>Nothing you saved earlier is lost. Try again; if it keeps happening, reload the page or tell the team what you were doing.</p>
      {error.digest ? <small>Reference: {error.digest}</small> : null}
      <div className={s.errorActions}>
        <button className={s.errorPrimary} onClick={reset} type="button">Try again</button>
        <button className={s.errorGhost} onClick={() => window.location.reload()} type="button">Reload page</button>
      </div>
    </div>
  );
}
