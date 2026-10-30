"use client";

import { createAgentKeyAction, disconnectClaudeAction, revokeAgentKeyAction } from "@/app/_actions/agent-actions";
import type { ConnectorConnection } from "@/lib/mcp/oauth";
import type { AgentTokenRow } from "@/lib/api/agent-tokens";
import { AGENT_MODULES } from "@/lib/agent/modules";
import { formatDay } from "@/lib/text/date";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { confirmAction, notify, notifyError } from "./app-dialog";
import { copyText } from "./copy-text";
import { HelpTip } from "./ui-kit";
import s from "./settings-workspace.module.css";

const noSubscribe = () => () => {};
const label = (id: string) => AGENT_MODULES.find((module) => module.id === id)?.label || id;

/** Settings → Claude access: keys that let Claude add and update data (never delete). */
export function ClaudeAccess({ tokens, connections = [] }: { tokens: AgentTokenRow[] | null; connections?: ConnectorConnection[] | null }) {
  const router = useRouter();
  const nameId = useId();
  const [name, setName] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<"" | "name" | "modules">("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<{ key: string; name: string } | null>(null);
  // The address people paste into Claude: this site + /api/mcp (known only in the browser).
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");

  if (!tokens) return <p className={s.hint}>Claude access needs the database update from this release (migration 027). Run <code>npm run vps:rebuild</code> on the server.</p>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setInvalid("name"); document.getElementById(nameId)?.focus(); return; }
    if (!modules.length) { setInvalid("modules"); return; }
    setBusy(true);
    try {
      const created = await createAgentKeyAction({ name, modules });
      setShown({ key: created.key, name: name.trim() });
      setName(""); setModules([]); setInvalid("");
      router.refresh();
    } catch (error) { notifyError(error, "Could not add the key."); } finally { setBusy(false); }
  }

  async function revoke(token: AgentTokenRow) {
    if (!(await confirmAction({ title: `Revoke "${token.name}"?`, message: "Claude stops being able to use this key at once. This cannot be undone; add a new key if needed.", confirmLabel: "Revoke key", danger: true }))) return;
    try { await revokeAgentKeyAction(token.id, token.name); notify("Key revoked."); router.refresh(); } catch (error) { notifyError(error, "Could not revoke the key."); }
  }

  async function disconnectOne(connection: ConnectorConnection) {
    if (!(await confirmAction({ title: `Disconnect Claude for ${connection.user_label}?`, message: "Claude stops reading and adding data for this person at once. They can connect again from Claude.", confirmLabel: "Disconnect Claude", danger: true }))) return;
    try { await disconnectClaudeAction(connection.id, connection.user_label); notify("Claude disconnected."); router.refresh(); } catch (error) { notifyError(error, "Could not disconnect Claude."); }
  }

  const active = tokens.filter((token) => !token.revoked_at);
  const connectorUrl = `${origin}/api/mcp`;
  return (
    <div className={s.stack}>
      <div className={s.card}>
        <div className={s.cardHead}>
          <h3>Connector</h3>
          <HelpTip label="About the connector">In Claude: Settings → Connectors → Add custom connector, paste this URL, then sign in with your own CareerCclub account and choose Allow. Claude can then read every module you can open and add or change data in your name. It can never delete or see passwords.</HelpTip>
        </div>
        <div className={s.keyRow}><code data-connector-url="">{connectorUrl}</code><button className={s.ghostSmall} onClick={() => { void copyText(connectorUrl); notify("Connector URL copied."); }} type="button"><i aria-hidden="true" className="ti ti-copy" /> Copy URL</button></div>
        {connections === null ? <p className={s.hint}>The connector needs the database update from this release (migration 034). Run <code>npm run vps:rebuild</code> on the server.</p>
          : connections.length ? (
            <ul className={s.keyList}>
              {connections.map((connection) => (
                <li key={connection.id}>
                  <div>
                    <b>{connection.user_label}</b>
                    <span className={s.keyMeta}>{connection.client_name || "Claude"} · connected {formatDay(connection.created_at)} · {connection.last_used_at ? `last used ${formatDay(connection.last_used_at)}` : "not used yet"}</span>
                  </div>
                  <button className={s.ghostSmall} onClick={() => void disconnectOne(connection)} type="button">Disconnect Claude</button>
                </li>
              ))}
            </ul>
          ) : <p className={s.hint}>Nobody has connected Claude yet.</p>}
      </div>
      <div className={s.card}>
        <div className={s.cardHead}>
          <h3>Keys</h3>
          <HelpTip label="About Claude access">A key lets Claude add and update data in the modules you choose, for example research for Job Vacancy MT. Claude always shows a preview first and changes nothing until you agree. It can never delete. Every change is in the activity log under the key&apos;s name. Revoke a key to stop it at once.</HelpTip>
        </div>
        {shown ? (
          <div className={s.keyShown} role="status">
            <p><b>Key for “{shown.name}”</b>: copy it now. It is shown only once.</p>
            <div className={s.keyRow}><code data-agent-key="">{shown.key}</code><button className={s.ghostSmall} onClick={() => { void copyText(shown.key); notify("Key copied."); }} type="button"><i aria-hidden="true" className="ti ti-copy" /> Copy key</button></div>
            <p className={s.hint}>Give it to Claude in a chat: “Use this Claude access key for internal.ccclub.id”. Done with it? <button className={s.linkButton} onClick={() => setShown(null)} type="button">Hide key</button></p>
          </div>
        ) : null}
        {tokens.length ? (
          <ul className={s.keyList}>
            {tokens.map((token) => (
              <li data-revoked={token.revoked_at ? "" : undefined} key={token.id}>
                <div>
                  <b>{token.name}</b>{token.revoked_at ? <span className={s.revokedChip}>Revoked</span> : null}
                  <span className={s.keyMeta}><code>{token.token_prefix}…</code> · {token.modules.map(label).join(", ")} · added {formatDay(token.created_at)} by {token.created_by} · {token.last_used_at ? `last used ${formatDay(token.last_used_at)}` : "not used yet"}</span>
                </div>
                {token.revoked_at ? null : <button className={s.ghostSmall} onClick={() => void revoke(token)} type="button">Revoke key</button>}
              </li>
            ))}
          </ul>
        ) : <p className={s.hint}>No keys yet. Add one below to let Claude update a module.</p>}
      </div>
      <form className={s.card} noValidate onSubmit={submit}>
        <div className={s.cardHead}><h3>Add key</h3></div>
        <label className={s.field} htmlFor={nameId}>
          <span>Name <b aria-hidden="true" className={s.req}>*</b></span>
          <input aria-invalid={invalid === "name" || undefined} className={invalid === "name" ? s.inputInvalid : s.input} id={nameId} maxLength={60} onChange={(event) => { setName(event.target.value); if (invalid === "name") setInvalid(""); }} placeholder="e.g. MT research" value={name} />
          {invalid === "name" ? <small className={s.fieldError}>Give the key a name.</small> : null}
        </label>
        <fieldset aria-invalid={invalid === "modules" || undefined} className={s.fieldset}>
          <legend>Modules Claude may update <b aria-hidden="true" className={s.req}>*</b></legend>
          {AGENT_MODULES.map((module) => (
            <label className={s.checkRow} key={module.id}><input checked={modules.includes(module.id)} onChange={(event) => { setModules((list) => event.target.checked ? [...list, module.id] : list.filter((id) => id !== module.id)); if (invalid === "modules") setInvalid(""); }} type="checkbox" />{module.label}</label>
          ))}
          {invalid === "modules" ? <small className={s.fieldError}>Choose at least one module.</small> : null}
        </fieldset>
        <div><button className={s.primary} disabled={busy} type="submit">{busy ? "Adding…" : "Add key"}</button></div>
        <p className={s.hint}>{active.length} active key{active.length === 1 ? "" : "s"}.</p>
      </form>
    </div>
  );
}
