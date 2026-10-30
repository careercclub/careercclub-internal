import { auth } from "@/auth";
import { getClient } from "@/lib/mcp/oauth";
import { redirectHost, redirectMatches } from "@/lib/mcp/oauth-rules";
import { redirect } from "next/navigation";
import styles from "../../sign-in/sign-in.module.css";
import consent from "./consent.module.css";
import { allowClaudeAction, denyClaudeAction } from "./actions";

export const metadata = { title: "Connect Claude" };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || "";

function Problem({ text }: { text: string }) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>CCC</div>
        <div><h1>Can’t connect Claude</h1><p className={styles.copy}>{text}</p></div>
      </section>
    </main>
  );
}

// Claude connector consent screen (Putaran 62). Opened by Claude with the OAuth parameters; the
// person must be signed in (the proxy sends them to sign-in and back here).
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await auth();
  const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => (value === undefined ? [] : [[key, one(value)]])));
  if (!session?.user) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/oauth/authorize?${query}`)}`);

  const clientId = one(params.client_id); const redirectUri = one(params.redirect_uri);
  const client = await getClient(clientId);
  // A wrong app or callback is never sent anywhere: the person sees why, and nothing else happens.
  if (!client || !redirectMatches(client.redirect_uris, redirectUri)) return <Problem text="This connect link is not valid or has expired. Start again from Claude: Settings → Connectors." />;
  const fail = (error: string) => { const url = new URL(redirectUri); url.searchParams.set("error", error); if (one(params.state)) url.searchParams.set("state", one(params.state)); redirect(url.toString()); };
  if (one(params.response_type) !== "code") fail("unsupported_response_type");
  if (one(params.code_challenge_method) !== "S256" || !one(params.code_challenge)) fail("invalid_request");
  if (session.user.id === "env-admin") return <Problem text="You are signed in with the setup admin from the server settings. Sign in with your own account to connect Claude." />;

  const who = session.user.name || session.user.email || "you";
  const role = String(session.user.role || "member").toLowerCase();
  const hidden = { client_id: clientId, redirect_uri: redirectUri, state: one(params.state), code_challenge: one(params.code_challenge) };
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>CCC</div>
        <div>
          <h1>Connect Claude</h1>
          <p className={styles.copy}>Claude will work in CareerCclub Internal as <b>{who}</b> ({role}).</p>
        </div>
        <ul className={consent.list}>
          <li><i aria-hidden="true" className="ti ti-eye" />Read every module you can open in the app</li>
          <li><i aria-hidden="true" className="ti ti-pencil" />Add and change data with your rights, recorded in your name</li>
          <li><i aria-hidden="true" className="ti ti-trash-off" />Never delete anything, never see or set passwords</li>
        </ul>
        <p className={consent.host}>You will go back to <b>{redirectHost(redirectUri)}</b>. An admin can disconnect it any time in Settings → Claude access.</p>
        <div className={consent.actions}>
          <form action={denyClaudeAction}>{Object.entries(hidden).map(([k, v]) => <input key={k} name={k} type="hidden" value={v} />)}<button className={consent.secondary} type="submit">Cancel</button></form>
          <form action={allowClaudeAction}>{Object.entries(hidden).map(([k, v]) => <input key={k} name={k} type="hidden" value={v} />)}<button className={consent.primary} type="submit">Allow Claude</button></form>
        </div>
      </section>
    </main>
  );
}
