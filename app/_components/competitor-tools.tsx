"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { StorageImage } from "./storage-image";
import { FilterBar, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Workspace = { profiles: ApiRecord[]; snapshots: ApiRecord[]; flags: ApiRecord[]; products: ApiRecord[]; prices: ApiRecord[] };
type PillTone = "red" | "amber" | "green" | "blue" | "purple" | "gray";

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter((item) => item.trim());
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) { try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* fall through */ } }
    return trimmed ? trimmed.split("|").map((item) => item.trim()).filter(Boolean) : [];
  }
  return [];
}
function parseObj(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim().startsWith("{")) { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function fmtN(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return String(value ?? "");
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

const CATEGORY: Record<string, { label: string; tone: PillTone }> = {
  direct: { label: "Direct", tone: "red" },
  indirect: { label: "Indirect", tone: "amber" },
  substitusi: { label: "Substitusi", tone: "blue" },
};
const THREAT_TONE: Record<string, PillTone> = { high: "red", medium: "amber", low: "green" };
const THREAT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PLATFORM_OPTS = ["Instagram", "TikTok", "YouTube", "X", "LinkedIn", "Website"];

function CompetitorLogo({ profile, size = 36 }: { profile: ApiRecord; size?: number }) {
  const logo = text(profile.logo_url);
  if (logo) return <StorageImage area="design-assets" label={text(profile.name)} objectKey={logo} />;
  return (
    <div className="grid shrink-0 place-items-center rounded-lg bg-[var(--purple-light)] font-bold text-[var(--purple-mid)]" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {(text(profile.name)[0] || "?").toUpperCase()}
    </div>
  );
}

export function CompetitorTools({ workspace }: { workspace: Workspace }) {
  const [tab, setTab] = useState<"overview" | "profiles" | "products">("overview");
  const [editing, setEditing] = useState<{ record: ApiRecord | null } | null>(null);

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as typeof tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="overview"><i className="ti ti-layout-dashboard" /> Overview</TabsTrigger>
            <TabsTrigger value="profiles"><i className="ti ti-building-store" /> Kompetitor</TabsTrigger>
            <TabsTrigger value="products"><i className="ti ti-tag" /> Produk &amp; Pricing</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setEditing({ record: null })} size="sm"><i className="ti ti-plus" /> Tambah</Button>
      </div>

      {tab === "overview" ? <OverviewTab workspace={workspace} onEdit={(record) => setEditing({ record })} /> : null}
      {tab === "profiles" ? <ProfilesTab workspace={workspace} onAdd={() => setEditing({ record: null })} onEdit={(record) => setEditing({ record })} /> : null}
      {tab === "products" ? <ProductsTab workspace={workspace} /> : null}

      {editing ? <ProfileModal profile={editing.record} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/* ── Overview ── */
function OverviewTab({ workspace, onEdit }: { workspace: Workspace; onEdit: (record: ApiRecord) => void }) {
  const { profiles, snapshots, flags } = workspace;
  const count = (cat: string) => profiles.filter((row) => text(row.category) === cat).length;
  const highThreat = profiles.filter((row) => text(row.threat_level) === "high").length;
  const threatList = profiles.filter((row) => text(row.threat_level)).sort((a, b) => (THREAT_ORDER[text(a.threat_level)] ?? 3) - (THREAT_ORDER[text(b.threat_level)] ?? 3));
  const latestThreat = (id: string) => {
    const snaps = snapshots.filter((snapshot) => String(snapshot.competitor_id) === id).sort((a, b) => text(b.snapshot_date).localeCompare(text(a.snapshot_date)));
    return text(snaps[0]?.threat_level) || text(profiles.find((profile) => String(profile.id) === id)?.threat_level);
  };

  return (
    <>
      <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
        <StatCard label="Total" value={profiles.length} />
        <StatCard label="Direct" tone="var(--red)" value={count("direct")} />
        <StatCard label="Indirect" tone="var(--amber)" value={count("indirect")} />
        <StatCard label="Substitusi" tone="var(--blue)" value={count("substitusi")} />
        <StatCard label="High Threat" tone="var(--red)" value={highThreat} />
      </StatsGrid>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="gap-0 p-4">
          <h3 className="mb-3 text-[13px] font-bold">Daftar Kompetitor</h3>
          {!profiles.length ? <p className="py-6 text-center text-[12px] text-muted-foreground">Belum ada kompetitor.</p> : profiles.map((profile) => {
            const id = String(profile.id);
            const flagCount = flags.filter((flag) => String(flag.competitor_id) === id).length;
            const threat = latestThreat(id);
            return (
              <button className="flex items-center gap-2.5 border-t border-border py-2.5 text-left first:border-0" key={id} onClick={() => onEdit(profile)} type="button">
                <CompetitorLogo profile={profile} size={34} />
                <div className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{text(profile.name)}</strong><span className="text-[10px] text-muted-foreground">{text(profile.niche) || "—"}</span></div>
                <div className="flex shrink-0 items-center gap-1">
                  {CATEGORY[text(profile.category)] ? <Pill tone={CATEGORY[text(profile.category)].tone}>{CATEGORY[text(profile.category)].label}</Pill> : null}
                  {threat ? <Pill tone={THREAT_TONE[threat] || "gray"}>{threat.toUpperCase()}</Pill> : null}
                  {flagCount > 0 ? <Pill tone="amber">🚩{flagCount}</Pill> : null}
                </div>
              </button>
            );
          })}
        </Card>

        <Card className="gap-0 p-4">
          <h3 className="mb-3 text-[13px] font-bold">Threat Level</h3>
          {!threatList.length ? <p className="py-6 text-center text-[12px] text-muted-foreground">Belum ada threat level yang diset.</p> : threatList.map((profile) => (
            <div className="flex items-center gap-2.5 border-t border-border py-2 first:border-0" key={String(profile.id)}>
              <CompetitorLogo profile={profile} size={30} />
              <div className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{text(profile.name)}</strong><span className="text-[10px] text-muted-foreground">{text(profile.niche) || "—"}</span></div>
              <Pill tone={THREAT_TONE[text(profile.threat_level)] || "gray"}>{text(profile.threat_level).toUpperCase()}</Pill>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

/* ── Kompetitor (profiles) ── */
function ProfilesTab({ workspace, onAdd, onEdit }: { workspace: Workspace; onAdd: () => void; onEdit: (record: ApiRecord) => void }) {
  const { profiles } = workspace;
  const [sort, setSort] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [pending, start] = useTransition();

  const audiences = useMemo(() => [...new Set(profiles.flatMap((row) => list(row.target_audience)))].sort(), [profiles]);
  const followersOf = (row: ApiRecord, platform: string) => Number(parseObj(row.followers)[platform] || 0);

  const filtered = useMemo(() => {
    let rows = profiles.filter((row) => (!category || text(row.category) === category) && (!audience || list(row.target_audience).includes(audience)));
    if (sort === "ig_desc") rows = [...rows].sort((a, b) => followersOf(b, "Instagram") - followersOf(a, "Instagram"));
    else if (sort === "tt_desc") rows = [...rows].sort((a, b) => followersOf(b, "TikTok") - followersOf(a, "TikTok"));
    else if (sort === "yt_desc") rows = [...rows].sort((a, b) => followersOf(b, "YouTube") - followersOf(a, "YouTube"));
    else if (sort === "threat_high") rows = rows.filter((row) => text(row.threat_level) === "high");
    else if (sort === "threat_med") rows = rows.filter((row) => text(row.threat_level) === "medium");
    else if (sort === "threat_low") rows = rows.filter((row) => text(row.threat_level) === "low");
    else if (sort === "name_asc") rows = [...rows].sort((a, b) => text(a.name).localeCompare(text(b.name)));
    return rows;
  }, [profiles, category, audience, sort]);

  function remove(id: string) {
    if (!window.confirm("Hapus kompetitor ini? Data akan dihapus permanen.")) return;
    start(async () => { await deleteManagedRecord("competitor_profiles", id); });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar>
          <select className={filterFieldClass} onChange={(event) => setSort(event.target.value)} value={sort}>
            <option value="">Urutkan...</option>
            <option value="ig_desc">Instagram Tertinggi</option>
            <option value="tt_desc">TikTok Tertinggi</option>
            <option value="yt_desc">YouTube Tertinggi</option>
            <option value="threat_high">Threat: High</option>
            <option value="threat_med">Threat: Medium</option>
            <option value="threat_low">Threat: Low</option>
            <option value="name_asc">Nama A-Z</option>
          </select>
          <select className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}>
            <option value="">Semua Kategori</option>
            <option value="direct">Direct</option>
            <option value="indirect">Indirect</option>
            <option value="substitusi">Substitusi</option>
          </select>
          <select className={filterFieldClass} onChange={(event) => setAudience(event.target.value)} value={audience}>
            <option value="">Semua Target Audience</option>
            {audiences.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </FilterBar>
        <Button onClick={onAdd} size="sm" variant="outline"><i className="ti ti-plus" /> Tambah Kompetitor</Button>
      </div>

      {!filtered.length ? (
        <Card className="p-12 text-center text-[12px] text-muted-foreground">Tidak ada kompetitor yang sesuai filter.</Card>
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {filtered.map((profile) => {
            const platforms = list(profile.platforms);
            const followers = Object.entries(parseObj(profile.followers));
            const url = text(profile.primary_url);
            return (
              <Card className="flex flex-col gap-0 p-4" key={String(profile.id)}>
                <div className="mb-2.5 flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CompetitorLogo profile={profile} size={40} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold">{text(profile.name)}</div>
                      {url ? <a className="text-[10px] text-[var(--purple-accent)]" href={url} rel="noreferrer" target="_blank">{url.replace(/^https?:\/\//, "").split("/")[0]}</a> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="p-1 text-muted-foreground" onClick={() => onEdit(profile)} type="button"><i className="ti ti-pencil" /></button>
                    <button className="p-1 text-[var(--red)]" disabled={pending} onClick={() => remove(String(profile.id))} type="button"><i className="ti ti-trash" /></button>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2.5">
                  {CATEGORY[text(profile.category)] ? <div><Pill tone={CATEGORY[text(profile.category)].tone}>{CATEGORY[text(profile.category)].label}</Pill></div> : null}
                  {platforms.length ? (
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Platform</div>
                      <div className="flex flex-wrap gap-1">{platforms.map((value) => <span className="rounded-full bg-[var(--purple-light)] px-2 py-0.5 text-[10px] text-[var(--purple-mid)]" key={value}>{value}</span>)}</div>
                    </div>
                  ) : null}
                  {text(profile.niche) ? <div><div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Niche</div><div className="text-[11px]">{text(profile.niche)}</div></div> : null}
                  {list(profile.target_audience).length ? (
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target Audience</div>
                      <div className="flex flex-wrap gap-1">{list(profile.target_audience).map((value) => <span className="rounded-full border border-border bg-[var(--bg)] px-2 py-0.5 text-[10px]" key={value}>{value}</span>)}</div>
                    </div>
                  ) : null}
                  {text(profile.notes) ? <div className="rounded-md border-l-[3px] border-border bg-[var(--bg)] px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">{text(profile.notes)}</div> : null}
                  {followers.length || text(profile.threat_level) ? (
                    <div className="mt-auto flex flex-wrap items-center gap-2.5 rounded-lg bg-[var(--bg)] px-2.5 py-2">
                      {text(profile.threat_level) ? <Pill tone={THREAT_TONE[text(profile.threat_level)] || "gray"}>{text(profile.threat_level).toUpperCase()}</Pill> : null}
                      {followers.map(([key, value]) => <span className="text-[11px] font-semibold text-[var(--purple-mid)]" key={key}><span className="font-normal text-muted-foreground">{key}</span> {fmtN(value)}</span>)}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── Produk & Pricing (read-only summary; full CRUD on the products sub-page) ── */
function ProductsTab({ workspace }: { workspace: Workspace }) {
  const { products, prices, profiles } = workspace;
  const [competitor, setCompetitor] = useState("");
  const profileName = (id: unknown) => text(profiles.find((row) => String(row.id) === String(id))?.name) || "—";
  const latestPrice = (productId: unknown) => {
    const rows = prices.filter((price) => String(price.product_id) === String(productId)).sort((a, b) => text(b.recorded_at).localeCompare(text(a.recorded_at)));
    if (rows[0]) return Number(rows[0].price ?? rows[0].harga);
    const prod = products.find((row) => String(row.id) === String(productId));
    return Number(prod?.harga ?? 0);
  };
  const filtered = competitor ? products.filter((row) => String(row.competitor_id) === competitor) : products;
  const groups = useMemo(() => {
    const map = new Map<string, ApiRecord[]>();
    filtered.forEach((row) => { const key = text(row.kategori) || text(row.category) || "Lainnya"; map.set(key, [...(map.get(key) || []), row]); });
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar>
          <select className={filterFieldClass} onChange={(event) => setCompetitor(event.target.value)} value={competitor}>
            <option value="">Semua Kompetitor</option>
            {profiles.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}
          </select>
        </FilterBar>
        <Button asChild size="sm" variant="outline"><Link href="/competitor-intel/products"><i className="ti ti-settings" /> Kelola produk &amp; harga</Link></Button>
      </div>

      {!filtered.length ? (
        <Card className="p-12 text-center text-[12px] text-muted-foreground"><i className="ti ti-tag-off mb-2 block text-3xl opacity-40" />Belum ada produk.</Card>
      ) : groups.map(([kategori, items]) => (
        <div className="grid gap-2" key={kategori}>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--purple-mid)]"><span className="rounded-full bg-[var(--purple-light)] px-2.5 py-0.5">{kategori}</span><span className="text-[11px] font-normal text-muted-foreground">{items.length} produk</span></div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            {items.map((product) => (
              <Card className="gap-1.5 p-3" key={String(product.id)}>
                <div className="line-clamp-2 text-[12px] font-semibold">{text(product.nama) || text(product.name) || "—"}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-muted-foreground">{profileName(product.competitor_id)}</span>
                  <span className="shrink-0 text-[12px] font-bold text-[var(--purple-mid)]">{latestPrice(product.id) ? `Rp${fmtN(latestPrice(product.id))}` : "—"}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Add / Edit profile modal (reuses generic record CRUD) ── */
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
  const [pending, start] = useTransition();

  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  function togglePlatform(value: string) { setPlatforms((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }

  function save() {
    if (!name.trim()) { window.alert("Nama wajib diisi!"); return; }
    const fol: Record<string, number> = {};
    if (folIg) fol.Instagram = Number(folIg);
    if (folTt) fol.TikTok = Number(folTt);
    if (folYt) fol.YouTube = Number(folYt);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("category", category);
    fd.set("primary_url", primaryUrl.trim());
    fd.set("platforms", JSON.stringify(platforms));
    fd.set("niche", niche.trim());
    fd.set("target_audience", audience.split("|").map((item) => item.trim()).filter(Boolean).join(" | "));
    fd.set("followers", JSON.stringify(fol));
    fd.set("threat_level", threat);
    fd.set("logo_url", logoUrl.trim());
    fd.set("notes", notes.trim());
    start(async () => {
      try {
        if (profile) await updateManagedRecord("competitor_profiles", String(profile.id), fd);
        else await createManagedRecord("competitor_profiles", fd);
        onClose();
      } catch (error) { window.alert(error instanceof Error ? error.message : "Gagal simpan kompetitor"); }
    });
  }

  const chip = (active: boolean) => `cursor-pointer rounded-full border px-2.5 py-1 text-[11px] ${active ? "border-[var(--purple-mid)] bg-[var(--purple-light)] text-[var(--purple-mid)]" : "border-border bg-white text-[var(--text)]"}`;
  const inputClass = "w-full rounded-[var(--radius)] border border-[var(--border-md)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--purple-accent)]";
  const labelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" onMouseDown={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-[520px] flex-col gap-0 overflow-hidden p-0" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-bold">{profile ? "Edit" : "Tambah"} Kompetitor</h2>
          <button onClick={onClose} type="button"><i className="ti ti-x" /></button>
        </div>
        <div className="flex flex-col gap-3.5 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className={labelClass}>Nama Kompetitor *</label><input className={inputClass} onChange={(event) => setName(event.target.value)} placeholder="Nama akun / brand" value={name} /></div>
            <div><label className={labelClass}>Kategori</label>
              <select className={inputClass} onChange={(event) => setCategory(event.target.value)} value={category}>
                <option value="">Pilih...</option><option value="direct">Direct</option><option value="indirect">Indirect</option><option value="substitusi">Substitusi</option>
              </select>
            </div>
          </div>
          <div><label className={labelClass}>URL / Link Utama</label><input className={inputClass} onChange={(event) => setPrimaryUrl(event.target.value)} placeholder="https://..." value={primaryUrl} /></div>
          <div>
            <label className={labelClass}>Platform</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTS.map((value) => <button className={chip(platforms.includes(value))} key={value} onClick={() => togglePlatform(value)} type="button">{value}</button>)}
            </div>
          </div>
          <div><label className={labelClass}>Niche / Positioning</label><input className={inputClass} onChange={(event) => setNiche(event.target.value)} placeholder="cth: career coaching, tes BUMN" value={niche} /></div>
          <div><label className={labelClass}>Target Audience</label><input className={inputClass} onChange={(event) => setAudience(event.target.value)} placeholder="Fresh grad | Mahasiswa | Jobseeker" value={audience} /><p className="mt-1 text-[10px] text-muted-foreground">Pisahkan dengan tanda |</p></div>
          <div>
            <label className={labelClass}>Followers</label>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="text-[10px] text-muted-foreground">Instagram</span><input className={inputClass} onChange={(event) => setFolIg(event.target.value)} placeholder="0" type="number" value={folIg} /></div>
              <div><span className="text-[10px] text-muted-foreground">TikTok</span><input className={inputClass} onChange={(event) => setFolTt(event.target.value)} placeholder="0" type="number" value={folTt} /></div>
              <div><span className="text-[10px] text-muted-foreground">YouTube</span><input className={inputClass} onChange={(event) => setFolYt(event.target.value)} placeholder="0" type="number" value={folYt} /></div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Threat Level</label>
            <div className="flex gap-4">
              {["low", "medium", "high"].map((value) => <label className="flex cursor-pointer items-center gap-1.5 text-[12px]" key={value}><input checked={threat === value} name="ci-threat" onChange={() => setThreat(value)} type="radio" /> {value.charAt(0).toUpperCase() + value.slice(1)}</label>)}
            </div>
          </div>
          <div><label className={labelClass}>Logo (URL / object key)</label><input className={inputClass} onChange={(event) => setLogoUrl(event.target.value)} placeholder="design-assets/... atau https://..." value={logoUrl} /></div>
          <div><label className={labelClass}>Catatan</label><textarea className={inputClass} onChange={(event) => setNotes(event.target.value)} placeholder="Observasi umum..." rows={2} value={notes} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Batal</Button>
          <Button disabled={pending} onClick={save} size="sm"><i className="ti ti-check" /> Simpan</Button>
        </div>
      </Card>
    </div>
  );
}
