// Where to go after signing in (e.g. back to the Claude connector's consent screen). Only a path
// on this app is kept, never another site, so the sign-in page cannot be used to send people away.
export function safeNextPath(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  try {
    const url = new URL(text, "http://app.local");
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//") || url.pathname === "/sign-in") return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}
