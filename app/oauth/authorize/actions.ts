"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import { getClient, issueCode } from "@/lib/mcp/oauth";
import { redirectMatches } from "@/lib/mcp/oauth-rules";
import { redirect } from "next/navigation";

// The consent screen's two buttons. Everything is checked again here: the page's hidden fields
// come from the browser.

function back(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return url.toString();
}

async function checked(formData: FormData) {
  const clientId = String(formData.get("client_id") || "");
  const redirectUri = String(formData.get("redirect_uri") || "");
  const client = await getClient(clientId);
  if (!client || !redirectMatches(client.redirect_uris, redirectUri)) throw new Error("This sign-in link is not valid. Start connecting again from Claude.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(formData.get("code_challenge") || ""))) throw new Error("This sign-in link is not valid. Start connecting again from Claude.");
  return { clientId, redirectUri, state: String(formData.get("state") || ""), challenge: String(formData.get("code_challenge") || "") };
}

export async function allowClaudeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { clientId, redirectUri, state, challenge } = await checked(formData);
  if (session.user.id === "env-admin") throw new Error("Sign in with your own account to connect Claude.");
  const code = await issueCode({ clientId, userId: session.user.id, redirectUri, codeChallenge: challenge });
  await logActivity({ userName: session.user.name || session.user.email || "CCC User", module: "Settings", action: "Connect Claude", detail: "Claude connector" });
  redirect(back(redirectUri, { code, state }));
}

export async function denyClaudeAction(formData: FormData) {
  const { redirectUri, state } = await checked(formData);
  redirect(back(redirectUri, { error: "access_denied", state }));
}
