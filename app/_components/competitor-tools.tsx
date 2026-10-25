"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ApiRecord } from "@/lib/api/_crud";
import { CATEGORY_LABEL, competitorSummary, filterCompetitors, fmtN, list, parseObj, priceBoard, threatOf, type CompetitorFilter, type Threat } from "@/lib/competitor/view";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { confirmAction, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import s from "./competitor-tools.module.css";
import { useRecordFocus } from "./use-record-focus";
import { compareText } from "@/lib/text/sort";
import { formatRupiah } from "./money-input";
import { formatRupiahShort } from "@/lib/text/money";

// Competitor Intel in the IJIS layout: a threat landscape (High / Medium / Low columns),
// a competitor directory and a price board. Same data and actions as before.

type Workspace = { profiles: ApiRecord[]; snapshots: ApiRecord[]; flags: ApiRecord[]; products: ApiRecord[]; prices: ApiRecord[] };
type View = "landscape" | "profiles" | "pricing";

const PLATFORM_OPTS = ["Instagram", "TikTok", "YouTube", "X", "LinkedIn", "Website"];
const PLATFORM_ICON: Record<string, string> = { Instagram: "ti-brand-instagram", TikTok: "ti-brand-tiktok", YouTube: "ti-brand-youtube", X: "ti-brand-x", LinkedIn: "ti-brand-linkedin", Website: "ti-world" };
const THREATS: Array<[Exclude<Threat, "">, string]> = [["high", "High threat"], ["medium", "Medium threat"], ["low", "Low threat"]];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function domain(url: string) { return url.replace(/^https?:\/\//, "").split("/")[0]; }

function CompetitorLogo({ profile, size = 40 }: { profile: ApiRecord; size?: number }) {
  const raw = text(profile.logo_url);
  const [resolved, setResolved] = useState<{ key: string; src: string } | null>(null);
  useEffect(() => {
    if (!raw || raw.startsWith("http")) return;
    const key = /^(uploads|collaborator-photos|design-assets|task-attachments)\//.test(raw) ? raw : `design-assets/${raw}`;
    const controller = new AbortController();
    fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "download", key }), signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
      .then((result: { url?: string }) => setResolved({ key: raw, src: result.url || "" }))
      .catch(() => { if (!controller.signal.aborted) setResolved({ key: raw, src: "" }); });
    return () => controller.abort();
  }, [raw]);
  const src = raw.startsWith("http") ? raw : resolved?.key === raw ? resolved.src : "";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) return <span aria-label={text(profile.name)} className={s.logo} role="img" style={{ ...style, backgroundImage: `url("${src.replaceAll('"', "%22")}")` }} />;
  return <span aria-hidden="true" className={s.logo} style={style}>{(text(profile.name)[0] || "?").toUpperCase()}</span>;
}

function ThreatChip({ threat }: { threat: Threat }) {
  if (!threat) return <span className={s.chipMuted}>No threat set</span>;
  return <span className={threat === "high" ? s.chipDanger : threat === "medium" ? s.chip : s.chipMuted}>{threat[0].toUpperCase() + threat.slice(1)} threat</span>;
}

export function CompetitorTools({ workspace }: { workspace: Workspace }) {
  const [view, setView] = useState<View>("landscape");
  const [editing, setEditing] = useState<{ record: ApiRecord | null } | null>(null);
  const summary = useMemo(() => competitorSummary(workspace.profiles, workspace.snapshots, workspace.flags), [workspace]);
  useRecordFocus((id) => {
    const record = workspace.profiles.find((row) => String(row.id) === id);
    if (!record) return;
    setEditing({ record });
    return true;
  });
  const views: Array<[View, string, number | null]> = [["landscape", "Threat landscape", null], ["profiles", "Competitors", summary.total], ["pricing", "Products & pricing", workspace.products.length]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>Intelligence</span>
          <h1>Competitor Intel</h1>
          <p>{summary.total} competitors · {summary.threat.high ? <b className={s.danger}>{summary.threat.high} high threat</b> : "none high threat"} · {summary.flags} flag{summary.flags === 1 ? "" : "s"} logged</p>
        </div>
        <Button onClick={() => setEditing({ record: null })}><i className="ti ti-plus" aria-hidden="true" /> Add competitor</Button>
      </header>

      <div className={s.segmented} role="tablist" aria-label="Competitor Intel view">
        {views.map(([id, label, count]) => <button aria-selected={view === id} className={view === id ? s.segmentActive : s.segment} key={id} onClick={() => setView(id)} role="tab" type="button">{label}{count !== null ? <span>{count}</span> : null}</button>)}
      </div>

      {view === "landscape" ? <Landscape onEdit={(record) => setEditing({ record })} summary={summary} workspace={workspace} /> : null}
      {view === "profiles" ? <Directory onEdit={(record) => setEditing({ record })} workspace={workspace} /> : null}
      {view === "pricing" ? <Pricing workspace={workspace} /> : null}

      {editing ? <ProfileModal onClose={() => setEditing(null)} profile={editing.record} /> : null}
    </div>
  );
}

/* ── Threat landscape ── */
function Landscape({ workspace, summary, onEdit }: { workspace: Workspace; summary: ReturnType<typeof competitorSummary>; onEdit: (record: ApiRecord) => void }) {
  const { profiles, snapshots, flags } = workspace;
  const [category, setCategory] = useState("");
  const shown = profiles.filter((row) => !category || text(row.category) === category);
  const columns: Array<[Threat, string]> = [...THREATS, ["", "Not rated"]];
  if (!profiles.length) return <p className={s.empty}>No competitors yet. Add the first one.</p>;
  return (
    <>
      <div className={s.pills} role="group" aria-label="Category">
        {[["", "All", summary.total] as const, ...Object.entries(CATEGORY_LABEL).map(([key, label]) => [key, label, summary.category[key] || 0] as const)].map(([key, label, count]) => (
          <button aria-pressed={category === key} className={category === key ? s.pillOn : s.pill} key={key || "all"} onClick={() => setCategory(key)} type="button">{label} <span>{count}</span></button>
        ))}
      </div>
      <div className={s.board}>
        {columns.filter(([t]) => t || shown.some((row) => !threatOf(row, snapshots))).map(([threat, label]) => {
          const items = shown.filter((row) => threatOf(row, snapshots) === threat);
          return (
            <section aria-label={`${label}, ${items.length}`} className={threat === "high" ? s.columnHigh : s.column} key={label}>
              <header className={s.columnHead}><b>{label}</b><span className={s.count}>{items.length}</span></header>
              {items.length ? (
                <ul className={s.cards}>
                  {items.map((row) => {
                    const id = String(row.id); const flagCount = flags.filter((flag) => String(flag.competitor_id) === id).length;
                    const fol = Object.entries(parseObj(row.followers)).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
                    return (
                      <li key={id}>
                        <button className={s.card} data-record-id={id} onClick={() => onEdit(row)} type="button">
                          <span className={s.cardTop}><CompetitorLogo profile={row} size={36} /><span className={s.cardName}><b>{text(row.name)}</b><small>{CATEGORY_LABEL[text(row.category)] || "No category"}{text(row.niche) ? ` · ${text(row.niche)}` : ""}</small></span></span>
                          <span className={s.cardFoot}>
                            {fol ? <span><i className={`ti ${PLATFORM_ICON[fol[0]] || "ti-users"}`} aria-hidden="true" /> {fmtN(fol[1])}</span> : <span className={s.muted}>No follower data</span>}
                            {flagCount ? <span className={s.flag}><i className="ti ti-flag" aria-hidden="true" /> {flagCount}</span> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className={s.emptySmall}>None</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ── Directory ── */
function Directory({ workspace, onEdit }: { workspace: Workspace; onEdit: (record: ApiRecord) => void }) {
  const { profiles, snapshots } = workspace;
  const [filter, setFilter] = useState<CompetitorFilter>({ query: "", category: "", threat: "", audience: "", sort: "" });
  const [pending, start] = useTransition();
  const audiences = useMemo(() => [...new Set(profiles.flatMap((row) => list(row.target_audience)))].sort(compareText), [profiles]);
  const shown = useMemo(() => filterCompetitors(profiles, snapshots, filter), [profiles, snapshots, filter]);
  const set = (patch: CompetitorFilter) => setFilter((current) => ({ ...current, ...patch }));
  const filtersOn = Boolean(filter.query || filter.category || filter.threat || filter.audience);
  async function remove(row: ApiRecord) {
    if (!(await confirmAction({ title: `Delete ${text(row.name) || "this competitor"}?`, message: "Its products, prices and snapshots stay, but lose their competitor. This cannot be undone.", confirmLabel: "Delete competitor", danger: true }))) return;
    start(() => guard(async () => { await deleteManagedRecord("competitor_profiles", String(row.id)); }, "Could not delete the competitor."));
  }
  return (
    <>
      <div className={s.toolbar}>
        <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search competitors" onChange={(e) => set({ query: e.target.value })} placeholder="Search name or niche…" value={filter.query} /></label>
        <label className={s.filterPill}><span>Category</span><select aria-label="Filter category" onChange={(e) => set({ category: e.target.value })} value={filter.category}><option value="">All</option>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className={s.filterPill}><span>Threat</span><select aria-label="Filter threat" onChange={(e) => set({ threat: e.target.value as Threat })} value={filter.threat}><option value="">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        {audiences.length ? <label className={s.filterPill}><span>Audience</span><select aria-label="Filter audience" onChange={(e) => set({ audience: e.target.value })} value={filter.audience}><option value="">All</option>{audiences.map((v) => <option key={v}>{v}</option>)}</select></label> : null}
        <label className={s.filterPill}><span>Sort</span><select aria-label="Sort competitors" onChange={(e) => set({ sort: e.target.value as CompetitorFilter["sort"] })} value={filter.sort}><option value="">As entered</option><option value="name">Name A–Z</option><option value="ig">Instagram followers</option><option value="tt">TikTok followers</option><option value="yt">YouTube followers</option></select></label>
        {filtersOn ? <button className={s.clear} onClick={() => set({ query: "", category: "", threat: "", audience: "" })} type="button">Clear filters</button> : null}
      </div>
      {shown.length ? (
        <ul aria-label="Competitors" className={s.directory}>
          {shown.map((row) => {
            const url = text(row.primary_url); const fol = Object.entries(parseObj(row.followers)); const platforms = list(row.platforms);
            return (
              <li className={s.profile} data-record-id={String(row.id)} key={String(row.id)}>
                <div className={s.profileHead}>
                  <CompetitorLogo profile={row} size={44} />
                  <div className={s.cardName}><b>{text(row.name)}</b>{url ? <a href={url} rel="noreferrer" target="_blank">{domain(url)}</a> : <small>{CATEGORY_LABEL[text(row.category)] || "No category"}</small>}</div>
                  <ThreatChip threat={threatOf(row, snapshots)} />
                </div>
                <dl className={s.facts}>
                  {url && CATEGORY_LABEL[text(row.category)] ? <div><dt>Category</dt><dd>{CATEGORY_LABEL[text(row.category)]}</dd></div> : null}
                  {text(row.niche) ? <div><dt>Niche</dt><dd>{text(row.niche)}</dd></div> : null}
                  {list(row.target_audience).length ? <div><dt>Audience</dt><dd>{list(row.target_audience).join(", ")}</dd></div> : null}
                  {platforms.length && !fol.length ? <div><dt>Platforms</dt><dd>{platforms.join(", ")}</dd></div> : null}
                </dl>
                {fol.length ? <div className={s.followers}>{fol.map(([key, value]) => <span key={key}><small>{key}</small><b>{fmtN(value)}</b></span>)}</div> : null}
                {text(row.notes) ? <p className={s.note}>{text(row.notes)}</p> : null}
                <div className={s.actions}>
                  <button aria-label={`Edit ${text(row.name)}`} className={s.iconButton} onClick={() => onEdit(row)} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                  <button aria-label={`Delete ${text(row.name)}`} className={s.iconDanger} disabled={pending} onClick={() => remove(row)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className={s.empty}>{profiles.length ? "No competitors match these filters." : "No competitors yet."}</p>}
    </>
  );
}

/* ── Products & pricing (read-only board; full editing on the products sub-page) ── */
function Pricing({ workspace }: { workspace: Workspace }) {
  const { products, prices, profiles } = workspace;
  const [competitor, setCompetitor] = useState("");
  const board = useMemo(() => priceBoard(competitor ? products.filter((row) => String(row.competitor_id) === competitor) : products, prices), [products, prices, competitor]);
  const profileOf = (id: unknown) => profiles.find((row) => String(row.id) === String(id));
  return (
    <>
      <div className={s.toolbar}>
        <label className={s.filterPill}><span>Competitor</span><select aria-label="Filter competitor" onChange={(e) => setCompetitor(e.target.value)} value={competitor}><option value="">All</option>{profiles.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</select></label>
        <span className={s.spacer} />
        <Link className={s.ghostButton} href="/competitor-intel/products"><i className="ti ti-settings" aria-hidden="true" /> Manage products &amp; prices</Link>
      </div>
      {board.length ? (
        <div className={s.priceGrid}>
          {board.map((group) => (
            <section aria-label={group.category} className={s.priceCard} key={group.category}>
              <header className={s.priceHead}><b>{group.category}</b><span>{group.items.length} product{group.items.length === 1 ? "" : "s"}{group.max > group.min ? ` · ${formatRupiahShort(group.min)}–${formatRupiahShort(group.max)}` : group.max ? ` · ${formatRupiahShort(group.max)}` : ""}</span></header>
              <ul className={s.priceList}>
                {group.items.map(({ product, price }) => {
                  const owner = profileOf(product.competitor_id);
                  return (
                    <li key={String(product.id)}>
                      {owner ? <CompetitorLogo profile={owner} size={28} /> : <span aria-label="Unknown brand" className={s.logo} role="img" style={{ width: 28, height: 28, fontSize: 14 }}><i className="ti ti-building-store" aria-hidden="true" /></span>}
                      <span className={s.cardName}><b>{text(product.nama) || text(product.name) || "—"}</b><small>{text(owner?.name) || "No competitor"}</small></span>
                      <span className={s.priceValue}>{price ? formatRupiah(price) : "—"}</span>
                      {group.max > group.min && price ? <span className={s.priceBar} aria-hidden="true"><i style={{ width: `${Math.max(6, ((price - group.min) / (group.max - group.min)) * 100)}%` }} /></span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : <p className={s.empty}>No products yet. Add them in Manage products &amp; prices.</p>}
    </>
  );
}

/* ── Add / Edit competitor ── */
function ProfileModal({ profile, onClose }: { profile: ApiRecord | null; onClose: () => void }) {
  const [name, setName] = useState(text(profile?.name));
  const [category, setCategory] = useState(text(profile?.category));
  const [primaryUrl, setPrimaryUrl] = useState(text(profile?.primary_url));
  const [platforms, setPlatforms] = useState<string[]>(list(profile?.platforms));
  const [niche, setNiche] = useState(text(profile?.niche));
  const [audience, setAudience] = useState(list(profile?.target_audience).join(" | "));
  const followers = parseObj(profile?.followers);
  const [folIg, setFolIg] = useState(text(followers.Instagram));
  const [folTt, setFolTt] = useState(text(followers.TikTok));
  const [folYt, setFolYt] = useState(text(followers.YouTube));
  const [threat, setThreat] = useState(text(profile?.threat_level) || "medium");
  const [logoUrl, setLogoUrl] = useState(text(profile?.logo_url));
  const [notes, setNotes] = useState(text(profile?.notes));
  const [invalid, setInvalid] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim()) { setInvalid(true); document.getElementById("competitor-name")?.focus(); return; }
    const fol: Record<string, number> = {};
    if (folIg) fol.Instagram = Number(folIg); if (folTt) fol.TikTok = Number(folTt); if (folYt) fol.YouTube = Number(folYt);
    const fd = new FormData();
    fd.set("name", name.trim()); fd.set("category", category); fd.set("primary_url", primaryUrl.trim()); fd.set("platforms", JSON.stringify(platforms));
    fd.set("niche", niche.trim()); fd.set("target_audience", audience.split("|").map((item) => item.trim()).filter(Boolean).join(" | "));
    fd.set("followers", JSON.stringify(fol)); fd.set("threat_level", threat); fd.set("logo_url", logoUrl.trim()); fd.set("notes", notes.trim());
    start(async () => {
      try { if (profile) await updateManagedRecord("competitor_profiles", String(profile.id), fd); else await createManagedRecord("competitor_profiles", fd); onClose(); }
      catch (error) { notifyError(error, "Could not save competitor."); }
    });
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader><DialogTitle>{profile ? "Edit competitor" : "Add competitor"}</DialogTitle><DialogDescription>Fields marked * are required.</DialogDescription></DialogHeader>
        <div className={s.form}>
          <div className={s.row2}>
            <label className={s.field}><span>Competitor name <b className={s.req}>*</b></span><input aria-invalid={invalid || undefined} autoFocus className={invalid ? s.inputInvalid : s.input} id="competitor-name" required onChange={(e) => { setName(e.target.value); setInvalid(false); }} placeholder="Account or brand name" value={name} /></label>
            <label className={s.field}><span>Category</span><select className={s.input} onChange={(e) => setCategory(e.target.value)} value={category}><option value="">Select category</option>{Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <div className={s.field}>
            <span>Threat level</span>
            <div className={s.segmentedSmall} role="radiogroup" aria-label="Threat level">
              {["low", "medium", "high"].map((value) => <button aria-checked={threat === value} className={threat === value ? (value === "high" ? s.optionDanger : s.optionOn) : s.option} key={value} onClick={() => setThreat(value)} role="radio" type="button">{value[0].toUpperCase() + value.slice(1)}</button>)}
            </div>
          </div>
          <label className={s.field}><span>Main URL</span><input className={s.input} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder="https://…" value={primaryUrl} /></label>
          <div className={s.field}>
            <span>Platforms</span>
            <div className={s.pills}>{PLATFORM_OPTS.map((value) => { const on = platforms.includes(value); return <button aria-pressed={on} className={on ? s.pillOn : s.pill} key={value} onClick={() => setPlatforms(on ? platforms.filter((p) => p !== value) : [...platforms, value])} type="button">{value}</button>; })}</div>
          </div>
          <div className={s.field}>
            <span>Followers</span>
            <div className={s.row3}>
              <label className={s.subField}><small>Instagram</small><input className={s.input} onChange={(e) => setFolIg(e.target.value)} placeholder="0" type="number" value={folIg} /></label>
              <label className={s.subField}><small>TikTok</small><input className={s.input} onChange={(e) => setFolTt(e.target.value)} placeholder="0" type="number" value={folTt} /></label>
              <label className={s.subField}><small>YouTube</small><input className={s.input} onChange={(e) => setFolYt(e.target.value)} placeholder="0" type="number" value={folYt} /></label>
            </div>
          </div>
          <label className={s.field}><span>Niche / positioning</span><input className={s.input} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. career coaching, BUMN test prep" value={niche} /></label>
          <label className={s.field}><span>Target audience</span><input className={s.input} onChange={(e) => setAudience(e.target.value)} placeholder="Fresh grad | Student | Jobseeker" value={audience} /><small className={s.hint}>Separate with |</small></label>
          <label className={s.field}><span>Logo (URL or file key)</span><input className={s.input} onChange={(e) => setLogoUrl(e.target.value)} placeholder="design-assets/… or https://…" value={logoUrl} /></label>
          <label className={s.field}><span>Notes</span><textarea className={s.input} onChange={(e) => setNotes(e.target.value)} placeholder="General observations…" rows={3} value={notes} /></label>
        </div>
        <DialogFooter sticky><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={pending} onClick={save} type="button">{pending ? "Saving…" : (profile ? "Save competitor" : "Add competitor")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
