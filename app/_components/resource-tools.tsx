"use client";

import { reorderResourcesAction } from "@/app/actions/resource-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { filterResources, groupResources, hostOf, hrefOf, isCredential, moveResource, plural, sortResources } from "@/lib/library/view";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { notify, notifyError } from "./app-dialog";
import { copyText } from "./copy-text";
import g from "./library.module.css";
import s from "./page-kit.module.css";
import { useRecordFocus } from "./use-record-focus";
import { ShowMoreList } from "./ui-kit";

// Resources in the IJIS layout: links and credentials grouped by category, one card per
// category. Same reorder action (urutan within a category) and the same manage table.

type Kind = "" | "link" | "credential";

export function ResourceTools({ rows, manage }: { rows: ApiRecord[]; manage: ReactNode }) {
  const [tab, setTab] = useState<"list" | "manage">("list");
  const [items, setItems] = useState(() => sortResources(rows));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [category, setCategory] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => filterResources(items, { query, kind, category }), [items, query, kind, category]);
  const groups = groupResources(visible);
  const categories = groupResources(items).map(([name, list]) => [name, list.length] as const);
  const credentials = items.filter(isCredential).length;
  const filtered = Boolean(query || kind || category);

  // Search result opened: clear the local filters so the record cannot be hidden by them.
  useRecordFocus((id) => { if (items.some((item) => String(item.id) === id)) { setTab("list"); if (filtered) { setQuery(""); setKind(""); setCategory(""); } } });

  function move(id: string, direction: -1 | 1) {
    const next = moveResource(items, id, direction);
    if (!next) return;
    setItems(next);
    startTransition(async () => {
      try { await reorderResourcesAction(next.map((row, position) => ({ id: String(row.id), kategori: String(row.kategori || "Other"), urutan: position }))); }
      catch (error) { notifyError(error, "Could not save the new order."); }
    });
  }
  async function copy(label: string, value: unknown) {
    if (await copyText(String(value || ""))) notify(`${label} copied.`);
    else notifyError(new Error("Copy is not available here."), `Could not copy the ${label.toLowerCase()}.`);
  }
  const toggle = (id: string) => setRevealed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Internal</span>
          <h1>Resources</h1>
          <p>{plural(items.length - credentials, "link")} · {plural(credentials, "login")} · {plural(categories.length, "category", "categories")}{pending ? " · saving order…" : ""}</p>
        </div>
        <div className={s.headActions}><button className={s.ghost} onClick={() => setTab("manage")} type="button"><i className="ti ti-pencil" aria-hidden="true" /> Manage resources</button></div>
      </header>

      <div aria-label="Views" className={s.segmented} role="tablist">
        <button aria-selected={tab === "list"} className={tab === "list" ? s.segmentActive : s.segment} onClick={() => setTab("list")} role="tab" type="button"><i className="ti ti-folders" aria-hidden="true" /> Resources <span>{items.length}</span></button>
        <button aria-selected={tab === "manage"} className={tab === "manage" ? s.segmentActive : s.segment} onClick={() => setTab("manage")} role="tab" type="button"><i className="ti ti-table" aria-hidden="true" /> Manage data</button>
      </div>

      {tab === "manage" ? manage : (
        <>
          <div className={s.toolbar}>
            <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search resources" onChange={(e) => setQuery(e.target.value)} placeholder="Search resources" value={query} /></label>
            <div className={s.pills} role="group" aria-label="Kind">
              {([["", "All", items.length], ["link", "Links", items.length - credentials], ["credential", "Logins", credentials]] as const).map(([value, label, count]) => (
                <button aria-pressed={kind === value} className={kind === value ? s.pillOn : s.pill} key={label} onClick={() => setKind(value)} type="button">{label} <span>{count}</span></button>
              ))}
            </div>
            {categories.length > 1 ? <label className={s.filterPill}><span>Category</span><select aria-label="Category" onChange={(e) => setCategory(e.target.value)} value={category}><option value="">All</option>{categories.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}</select></label> : null}
          </div>

          {groups.length ? (
            <div className={g.resourceGroups}>
              {groups.map(([group, list]) => (
                <section aria-label={group} className={g.resourceCard} key={group}>
                  <header className={g.resourceHead}><i className="ti ti-folder" aria-hidden="true" /><h2>{group}</h2><span className={s.chipMuted}>{plural(list.length, "item")}</span></header>
                  <ShowMoreList items={list} step={8}>{(visibleItems) => visibleItems.map((row) => {
                    const id = String(row.id);
                    const cred = isCredential(row);
                    const show = revealed.has(id);
                    const name = String(row.nama || "Untitled");
                    const peers = items.filter((item) => (String(item.kategori || "") || "Other") === group);
                    const at = peers.findIndex((item) => String(item.id) === id);
                    return (
                      <div className={g.resource} data-record-id={id} key={id}>
                        <span className={cred ? `${g.kind} ${g.kindCred}` : g.kind} title={cred ? "Login" : "Link"}><i className={`ti ti-${cred ? "lock" : "link"}`} aria-hidden="true" /></span>
                        <div className={g.resourceBody}>
                          <div className={g.resourceTitle}>
                            <b>{name}</b>
                            {row.url ? <a href={hrefOf(row.url)} rel="noreferrer" target="_blank" title={String(row.url)}>{hostOf(row.url)} <i className="ti ti-external-link" aria-hidden="true" /></a> : null}
                          </div>
                          {row.username || row.email || row.password ? (
                            <div className={g.secrets}>
                              {row.username ? <div className={g.secret}><span>Username</span><code>{String(row.username)}</code><button aria-label={`Copy username for ${name}`} className={g.mini} onClick={() => copy("Username", row.username)} type="button"><i className="ti ti-copy" aria-hidden="true" /></button></div> : null}
                              {row.email ? <div className={g.secret}><span>Email</span><code>{String(row.email)}</code><button aria-label={`Copy email for ${name}`} className={g.mini} onClick={() => copy("Email", row.email)} type="button"><i className="ti ti-copy" aria-hidden="true" /></button></div> : null}
                              {row.password ? (
                                <div className={g.secret}>
                                  <span>Password</span>
                                  <code aria-label={show ? undefined : "Hidden password"}>{show ? String(row.password) : "••••••••"}</code>
                                  <button aria-label={`${show ? "Hide" : "Show"} password for ${name}`} aria-pressed={show} className={g.mini} onClick={() => toggle(id)} type="button"><i className={`ti ti-eye${show ? "-off" : ""}`} aria-hidden="true" /></button>
                                  <button aria-label={`Copy password for ${name}`} className={g.mini} onClick={() => copy("Password", row.password)} type="button"><i className="ti ti-copy" aria-hidden="true" /></button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {row.notes ? <p className={g.resourceNote}>{String(row.notes)}</p> : null}
                        </div>
                        <div className={g.order}>
                          {row.url ? <button aria-label={`Copy URL of ${name}`} className={g.mini} onClick={() => copy("URL", row.url)} type="button"><i className="ti ti-copy" aria-hidden="true" /></button> : null}
                          <button aria-label={`Move ${name} up`} className={g.mini} disabled={pending || filtered || at <= 0} title={filtered ? "Clear the filters to reorder" : undefined} onClick={() => move(id, -1)} type="button"><i className="ti ti-chevron-up" aria-hidden="true" /></button>
                          <button aria-label={`Move ${name} down`} className={g.mini} disabled={pending || filtered || at >= peers.length - 1} title={filtered ? "Clear the filters to reorder" : undefined} onClick={() => move(id, 1)} type="button"><i className="ti ti-chevron-down" aria-hidden="true" /></button>
                        </div>
                      </div>
                    );
                  })}</ShowMoreList>
                </section>
              ))}
            </div>
          ) : (
            <div className={s.card}>
              <p className={s.empty}>{items.length ? "No resources match these filters." : "No resources yet. Add links and logins the team shares."}</p>
              {filtered ? <button className={s.ghost} onClick={() => { setQuery(""); setKind(""); setCategory(""); }} style={{ alignSelf: "center" }} type="button">Clear filters</button> : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
