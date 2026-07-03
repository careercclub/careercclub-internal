"use client";

import { saveCompetitorIntelListsAction, saveMenuLabelsAction, saveMenuVisibilityAction } from "@/app/actions/settings-actions";
import { RecordManager } from "@/app/_components/record-manager";
import { UserManagement } from "@/app/_components/user-management";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import type { AuthUserRecord } from "@/lib/api/auth-users";
import { useState } from "react";

type Page = { slug: string; title: string; section: string; path: string; icon: string };
type SafeUser = Pick<AuthUserRecord, "id" | "email" | "name" | "role" | "is_active" | "created_at">;

function jsonValue(rows: ApiRecord[], key: string): unknown {
  const row = rows.find((item) => item.key === key);
  let value = row?.value;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value ?? null;
}

function hiddenSlugs(rows: ApiRecord[]) {
  const value = jsonValue(rows, "menu_visibility");
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object" && "hiddenSlugs" in (value as Record<string, unknown>)) {
    const list = (value as { hiddenSlugs?: unknown }).hiddenSlugs;
    if (Array.isArray(list)) return list.map(String);
  }
  return [] as string[];
}

function menuLabelMaps(rows: ApiRecord[]) {
  const value = jsonValue(rows, "menu_labels") as { sections?: { section: string; label: string }[]; items?: { slug: string; label: string }[] } | null;
  const sections = new Map((value?.sections || []).map((entry) => [entry.section, entry.label]));
  const items = new Map((value?.items || []).map((entry) => [entry.slug, entry.label]));
  return { sections, items };
}

function stringListValue(rows: ApiRecord[], key: string) {
  const value = jsonValue(rows, key);
  return Array.isArray(value) ? value.map(String) : [];
}

function TicketStatusEmailPanel({ divisions, people }: { divisions: ApiRecord[]; people: ApiRecord[] }) {
  return (
    <div className="grid gap-3.5">
      <Card className="gap-3 p-5">
        <h2 className="text-sm font-bold">Alur Status Ticket</h2>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="rounded-full bg-[var(--amber-bg)] px-3 py-1 font-medium text-[var(--amber)]">Todo</span>
          <i className="ti ti-arrow-right text-muted-foreground" />
          <span className="rounded-full bg-[var(--blue-bg)] px-3 py-1 font-medium text-[var(--blue)]">In Progress</span>
          <i className="ti ti-arrow-right text-muted-foreground" />
          <span className="rounded-full bg-[var(--green-bg)] px-3 py-1 font-medium text-[var(--green)]">Done</span>
        </div>
      </Card>
      <Card className="gap-3 p-5">
        <div><h2 className="text-sm font-bold">Aturan Pengiriman Email</h2><p className="mt-1 text-[11px] text-muted-foreground">Notifikasi ticket dikirim ke Lead dan Staff pada divisi terkait.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {divisions.map((division) => {
            const divisionId = String(division.id);
            const members = people.filter((person) => String(person.divisi_id) === divisionId);
            const leads = members.filter((person) => person.level === "lead");
            const staff = members.filter((person) => person.level !== "lead" && person.level !== "admin");
            return (
              <div className="rounded-lg border border-border p-3" key={divisionId}>
                <strong className="text-[12px] font-semibold">{String(division.nama)}</strong>
                {leads.length ? <div className="mt-2"><span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">Lead</span><ul className="mt-1 grid gap-0.5 text-[11px]">{leads.map((person) => <li key={String(person.id)}>{String(person.nama)} · {String(person.email)}</li>)}</ul></div> : null}
                {staff.length ? <div className="mt-2"><span className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">Staff</span><ul className="mt-1 grid gap-0.5 text-[11px]">{staff.map((person) => <li key={String(person.id)}>{String(person.nama)} · {String(person.email)}</li>)}</ul></div> : null}
                {!members.length ? <p className="mt-2 text-[11px] text-muted-foreground">Belum ada anggota.</p> : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function CompetitorIntelLists({ categories, targetAudience }: { categories: string[]; targetAudience: string[] }) {
  const [cats, setCats] = useState(categories);
  const [audiences, setAudiences] = useState(targetAudience);
  const [catInput, setCatInput] = useState("");
  const [audienceInput, setAudienceInput] = useState("");
  return (
    <form action={saveCompetitorIntelListsAction} className="grid gap-3.5 sm:grid-cols-2">
      <Card className="gap-3 p-5">
        <h2 className="text-sm font-bold">Kategori Produk Kompetitor</h2>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((cat) => (
            <span className="flex items-center gap-1 rounded-full bg-[var(--purple-light)] px-2.5 py-1 text-[11px] text-[var(--purple-mid)]" key={cat}>
              <input name="category" type="hidden" value={cat} />
              {cat}
              <button aria-label={`Remove ${cat}`} className="ml-1" onClick={() => setCats(cats.filter((item) => item !== cat))} type="button"><i className="ti ti-x" /></button>
            </span>
          ))}
          {!cats.length ? <span className="text-[11px] text-muted-foreground">Belum ada kategori.</span> : null}
        </div>
        <div className="flex gap-1.5">
          <input className="h-8 flex-1 rounded-md border border-input px-2.5 text-xs" onChange={(event) => setCatInput(event.target.value)} placeholder="Nama kategori baru..." value={catInput} />
          <Button onClick={() => { if (catInput.trim()) { setCats([...cats, catInput.trim()]); setCatInput(""); } }} size="sm" type="button">Tambah</Button>
        </div>
      </Card>
      <Card className="gap-3 p-5">
        <h2 className="text-sm font-bold">Target Audience Kompetitor</h2>
        <div className="flex flex-wrap gap-1.5">
          {audiences.map((audience) => (
            <span className="flex items-center gap-1 rounded-full bg-[var(--blue-bg)] px-2.5 py-1 text-[11px] text-[var(--blue)]" key={audience}>
              <input name="target_audience" type="hidden" value={audience} />
              {audience}
              <button aria-label={`Remove ${audience}`} className="ml-1" onClick={() => setAudiences(audiences.filter((item) => item !== audience))} type="button"><i className="ti ti-x" /></button>
            </span>
          ))}
          {!audiences.length ? <span className="text-[11px] text-muted-foreground">Belum ada target audience.</span> : null}
        </div>
        <div className="flex gap-1.5">
          <input className="h-8 flex-1 rounded-md border border-input px-2.5 text-xs" onChange={(event) => setAudienceInput(event.target.value)} placeholder="Target audience baru..." value={audienceInput} />
          <Button onClick={() => { if (audienceInput.trim()) { setAudiences([...audiences, audienceInput.trim()]); setAudienceInput(""); } }} size="sm" type="button">Tambah</Button>
        </div>
      </Card>
      <Button className="w-max sm:col-span-2" type="submit">Simpan perubahan</Button>
    </form>
  );
}

export function SettingsWorkspace({
  settings,
  pages,
  masterProduk,
  divisions,
  people,
  types,
  platforms,
  categories,
  linkTemplates,
  klasifikasi,
  ctaOptions,
  isAdmin,
  users,
}: {
  settings: ApiRecord[];
  pages: Page[];
  masterProduk: ApiRecord[];
  divisions: ApiRecord[];
  people: ApiRecord[];
  types: ApiRecord[];
  platforms: ApiRecord[];
  categories: ApiRecord[];
  linkTemplates: ApiRecord[];
  klasifikasi: ApiRecord[];
  ctaOptions: ApiRecord[];
  isAdmin: boolean;
  users: SafeUser[];
}) {
  const [tab, setTab] = useState("master-produk");
  const [ticketTab, setTicketTab] = useState("divisi");
  const hidden = new Set(hiddenSlugs(settings));
  const labels = menuLabelMaps(settings);
  const sectionNames = [...new Set(pages.map((page) => page.section))];
  const ciCategories = stringListValue(settings, "ci_product_categories");
  const ciTargetAudience = stringListValue(settings, "ci_target_audience");

  return (
    <div className="grid gap-3.5">
      <Tabs onValueChange={setTab} value={tab}>
        <TabsList className="h-auto w-full flex-wrap justify-start" variant="line">
          <TabsTrigger value="master-produk">Master Produk</TabsTrigger>
          <TabsTrigger value="master-ticket">Master Ticket</TabsTrigger>
          <TabsTrigger value="pain-point">Customer Knowledge Master</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="link-templates">Link Template</TabsTrigger>
          <TabsTrigger value="ci-lists">Competitor Intel</TabsTrigger>
          <TabsTrigger value="klasifikasi">Klasifikasi Produk</TabsTrigger>
          <TabsTrigger value="content-planning">Content Planning</TabsTrigger>
          {isAdmin ? <TabsTrigger value="users">Users & Roles</TabsTrigger> : null}
        </TabsList>
      </Tabs>

      {tab === "master-produk" ? <RecordManager definitionKey="master_produk" rows={masterProduk} /> : null}

      {tab === "master-ticket" ? (
        <div className="grid gap-3">
          <Tabs onValueChange={setTicketTab} value={ticketTab}>
            <TabsList variant="line">
              <TabsTrigger value="divisi">Divisi</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="tipe">Tipe Request</TabsTrigger>
              <TabsTrigger value="flow">Status & Email</TabsTrigger>
            </TabsList>
          </Tabs>
          {ticketTab === "divisi" ? <RecordManager definitionKey="tkt_divisi" rows={divisions} /> : null}
          {ticketTab === "people" ? <RecordManager definitionKey="tkt_people" rows={people} /> : null}
          {ticketTab === "tipe" ? <RecordManager definitionKey="tkt_types" rows={types} /> : null}
          {ticketTab === "flow" ? <TicketStatusEmailPanel divisions={divisions} people={people} /> : null}
        </div>
      ) : null}

      {tab === "pain-point" ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <RecordManager definitionKey="pain_point_platforms" rows={platforms} />
          <RecordManager definitionKey="pain_point_categories" rows={categories} />
        </div>
      ) : null}

      {tab === "menu" ? (
        <div className="grid gap-3.5">
          <Card className="gap-3 p-5">
            <div><h2 className="text-sm font-bold">Sidebar modules</h2><p className="mt-1 text-[11px] text-muted-foreground">Hidden modules remain routable by direct URL. This setting controls navigation visibility only.</p></div>
            <form action={saveMenuVisibilityAction} className="grid gap-3.5">
              {sectionNames.map((section) => (
                <fieldset className="rounded-lg border border-border p-3" key={section}>
                  <legend className="px-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{section}</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {pages.filter((page) => page.section === section).map((page) => (
                      <label className="flex items-center gap-1.5 text-[12px]" key={page.slug}>
                        <input name="all_slug" type="hidden" value={page.slug} />
                        <input defaultChecked={!hidden.has(page.slug)} name="visible_slug" type="checkbox" value={page.slug} />
                        <i className={`ti ${page.icon}`} /><span>{page.title}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Button className="w-max" type="submit">Save menu visibility</Button>
            </form>
          </Card>
          <Card className="gap-3 p-5">
            <div><h2 className="text-sm font-bold">Sidebar labels</h2><p className="mt-1 text-[11px] text-muted-foreground">Rename section headings and menu item labels shown in the sidebar.</p></div>
            <form action={saveMenuLabelsAction} className="grid gap-3.5">
              {sectionNames.map((section) => (
                <fieldset className="rounded-lg border border-border p-3" key={section}>
                  <input name="all_section" type="hidden" value={section} />
                  <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    Section:
                    <input className="h-7 rounded-md border border-input px-2 text-[12px] font-normal normal-case" defaultValue={labels.sections.get(section) ?? section} name={`section_label__${section}`} />
                  </label>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {pages.filter((page) => page.section === section).map((page) => (
                      <label className="flex items-center gap-1.5 text-[12px]" key={page.slug}>
                        <input name="all_slug" type="hidden" value={page.slug} />
                        <i className={`ti ${page.icon}`} />
                        <input className="h-7 flex-1 rounded-md border border-input px-2 text-[12px]" defaultValue={labels.items.get(page.slug) ?? page.title} name={`item_label__${page.slug}`} />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Button className="w-max" type="submit">Save sidebar labels</Button>
            </form>
          </Card>
        </div>
      ) : null}

      {tab === "link-templates" ? <RecordManager definitionKey="event_link_templates" rows={linkTemplates} /> : null}

      {tab === "ci-lists" ? <CompetitorIntelLists categories={ciCategories} targetAudience={ciTargetAudience} /> : null}

      {tab === "klasifikasi" ? <RecordManager definitionKey="product_klasifikasi" rows={klasifikasi} /> : null}

      {tab === "content-planning" ? <RecordManager definitionKey="carousel_cta_options" rows={ctaOptions} /> : null}

      {tab === "users" && isAdmin ? <UserManagement users={users} /> : null}
    </div>
  );
}
