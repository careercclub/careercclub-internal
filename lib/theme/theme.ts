// Light / Dark. Light is the default; Dark is a per-browser choice (a viewer convenience, like a
// zoom level). <html data-theme> holds the look so CSS needs one selector. The same rule runs in
// the inline <head> script (no flash on load) and in the switch.

export type Theme = "light" | "dark";
export const THEME_KEY = "ccc-theme";

/** Only an explicit "dark" turns dark mode on; anything else (nothing stored, blocked storage) is light. */
export function themeFrom(stored: string | null): Theme {
  return stored === "dark" ? "dark" : "light";
}

export function readTheme(): Theme {
  try {
    return themeFrom(localStorage.getItem(THEME_KEY));
  } catch {
    return "light";
  }
}

/** Runs before first paint (inlined in app/layout.tsx). Keep it in sync with themeFrom. */
export const THEME_BOOT_SCRIPT = `(function(){var t="light";try{if(localStorage.getItem("${THEME_KEY}")==="dark")t="dark";}catch(e){}document.documentElement.dataset.theme=t;})();`;
