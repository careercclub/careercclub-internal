// Only this app's pages may send (no cross-site calls), and only from the configured sending
// domain: a person picks the name and the address before the @, never another domain (Putaran 58).
export function senderAddress(requested: unknown, configured = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev") {
  const domain = configured.split("@")[1]?.toLowerCase() || "";
  const value = typeof requested === "string" ? requested.trim().toLowerCase() : "";
  return value && /^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(value) && value.split("@")[1] === domain ? value : configured;
}
