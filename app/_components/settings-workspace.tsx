"use client";

import { isBlocked } from "@/lib/tickets/people";
import { confirmDelete } from "./confirm-delete";
import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/_actions/record-actions";
import { saveCompetitorIntelListsAction, saveMenuLabelsAction, saveMenuVisibilityAction } from "@/app/_actions/settings-actions";
import { RecordManager } from "@/app/_components/record-manager";
import { UserManagement } from "@/app/_components/user-management";
import { Button } from "@/components/ui/button";
import { SETTINGS_SECTIONS, TICKET_SETUP_SECTIONS, isSettingsSection, type SettingsSectionId, type TicketSetupSectionId } from "@/lib/records/links";
import { useRecordFocus } from "./use-record-focus";
import type { ApiRecord } from "@/lib/api/_crud";
import type { AuthUserRecord } from "@/lib/api/auth-users";
import { useState, useTransition } from "react";
import { confirmAction, notifyError } from "./app-dialog";
import { guard, submitTo } from "./safe-action";
import s from "./settings-workspace.module.css";
import { HelpTip } from "./ui-kit";
import { ClaudeAccess } from "./claude-access";
import type { AgentTokenRow } from "@/lib/api/agent-tokens";

type Page = { slug: string; title: string; section: string; path: string; icon: string };
type SafeUser = Pick<AuthUserRecord, "id" | "email" | "name" | "role" | "is_active" | "created_at">;

const WORKSPACE = new Set<SettingsSectionId>(["menu", "users", "claude"]);
const SECTION_META: Record<SettingsSectionId, { icon: string; description: string }> = {
  menu: { icon: "ti-layout-sidebar", description: "Choose which modules the sidebar shows and what they are called." },
  users: { icon: "ti-users", description: "Who can sign in, and what each person is allowed to change." },
  claude: { icon: "ti-sparkles", description: "Keys that let Claude add and update data from research — always previewed first, never deleting." },
  tickets: { icon: "ti-ticket", description: "Divisions, people and request types used by Tickets, and how ticket status and notifications work." },
  "customer-knowledge": { icon: "ti-message-circle", description: "Platforms and categories offered when logging a pain point." },
  "product-classes": { icon: "ti-tag", description: "Classifications used to group products and CRM buyers." },
  "product-mapping": { icon: "ti-arrows-exchange", description: "Turns product names imported from Lynkid into the internal classifications." },
  "carousel-ctas": { icon: "ti-click", description: "Call-to-action options offered in carousel plans." },
  "link-templates": { icon: "ti-link", description: "Saved link templates for Program events." },
  "competitor-lists": { icon: "ti-list-details", description: "Product categories and target audiences offered in Competitor Intel." },
};
const PLATFORM_ICONS: Record<string, string> = { tiktok: "ti-brand-tiktok", instagram: "ti-brand-instagram", youtube: "ti-brand-youtube", twitter: "ti-brand-x", x: "ti-brand-x", facebook: "ti-brand-facebook", threads: "ti-brand-threads" };

function platformIcon(name: string) {
  return PLATFORM_ICONS[name.trim().toLowerCase()] ?? "ti-tag";
}


function CustomerKnowledgeMasterPanel({ platforms, categories }: { platforms: ApiRecord[]; categories: ApiRecord[] }) {
  const [pending, start] = useTransition();
  async function remove(kind: "pain_point_platforms" | "pain_point_categories", row: ApiRecord) {
    const what = kind === "pain_point_platforms" ? "platform" : "category";
    if (!(await confirmDelete({ recordKey: kind, ids: [String(row.id)], title: `Delete ${what} "${String(row.nama)}"?`, confirmLabel: kind === "pain_point_platforms" ? "Delete platform" : "Delete category" }))) return;
    start(() => guard(async () => { await deleteManagedRecord(kind, String(row.id)); }, "Could not delete it from the list."));
  }
  return (
    <div className={s.twoCols}>
      <section aria-labelledby="set-platforms" className={s.card}>
        <div className={s.cardHead}><h3 id="set-platforms"><i className="ti ti-device-mobile" aria-hidden="true" /> Platforms</h3><span className={s.count}>{platforms.length}</span></div>
        <p className={s.hint}>Where comments and discussions come from when someone logs a pain point.</p>
        <ul className={s.chips}>
          {platforms.map((platform) => (
            <li className={s.chipItem} data-record-id={String(platform.id)} key={String(platform.id)}>
              <i className={`ti ${platformIcon(String(platform.nama))}`} aria-hidden="true" /><span>{String(platform.nama)}</span>
              <button aria-label={`Delete ${String(platform.nama)}`} disabled={pending} onClick={() => remove("pain_point_platforms", platform)} type="button"><i className="ti ti-x" aria-hidden="true" /></button>
            </li>
          ))}
          {!platforms.length ? <li className={s.hint}>No platforms yet.</li> : null}
        </ul>
        <AddForm action={createManagedRecord.bind(null, "pain_point_platforms")} label="Platform name" placeholder="e.g. Instagram" submit="Add platform" />
      </section>
      <section aria-labelledby="set-categories" className={s.card}>
        <div className={s.cardHead}><h3 id="set-categories"><i className="ti ti-tags" aria-hidden="true" /> Categories</h3><span className={s.count}>{categories.length}</span></div>
        <p className={s.hint}>The categories offered when logging a pain point.</p>
        <ul className={s.rows}>
          {categories.map((category) => (
            <li data-record-id={String(category.id)} key={String(category.id)}>
              <span>{String(category.nama)}</span>
              <button aria-label={`Delete ${String(category.nama)}`} className={s.iconDanger} disabled={pending} onClick={() => remove("pain_point_categories", category)} type="button"><i className="ti ti-trash" aria-hidden="true" /></button>
            </li>
          ))}
          {!categories.length ? <li className={s.hint}>No categories yet.</li> : null}
        </ul>
        <AddForm action={createManagedRecord.bind(null, "pain_point_categories")} label="Category name" placeholder="e.g. CV" submit="Add category" />
      </section>
    </div>
  );
}

/** One-field add form: empty submit marks the field red and keeps focus there. */
function AddForm({ action, label, placeholder, submit }: { action: (fd: FormData) => Promise<unknown>; label: string; placeholder: string; submit: string }) {
  const [invalid, setInvalid] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form className={s.addForm} noValidate onSubmit={(event) => {
      event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form);
      if (!String(fd.get("nama") || "").trim()) { setInvalid(true); (form.elements.namedItem("nama") as HTMLElement | null)?.focus(); return; }
      start(async () => { try { await action(fd); form.reset(); } catch (error) { notifyError(error, "Could not save."); } });
    }}>
      <label className={s.grow}><span className="sr-only">{label}</span><input aria-invalid={invalid || undefined} className={invalid ? s.inputInvalid : s.input} name="nama" onInput={() => setInvalid(false)} placeholder={`${label} *, ${placeholder}`} /></label>
      <Button disabled={pending} size="sm" type="submit">{submit}</Button>
    </form>
  );
}

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
    <div className={s.stack}>
      <section aria-labelledby="set-flow" className={s.card}>
        <h3 id="set-flow">Ticket status flow</h3>
        <ol className={s.flow}>{["Todo", "In Progress", "Done"].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
      </section>
      <section aria-labelledby="set-email" className={s.card}>
        <h3 id="set-email">Division members</h3>
        <p className={s.hint}>Ticket notifications (in the app and on the phone) go to everyone who can open the ticket: its requester, assignees, the Lead of an assignee’s division, and admins — not the person who made the change. There are no ticket emails. Blocked accounts get nothing.</p>
        <div className={s.divisionGrid}>
          {divisions.map((division) => {
            const divisionId = String(division.id);
            const members = people.filter((person) => String(person.divisi_id) === divisionId);
            const leads = members.filter((person) => person.level === "lead");
            const staff = members.filter((person) => person.level !== "lead" && person.level !== "admin");
            return (
              <div className={s.division} key={divisionId}>
                <b>{String(division.nama)}</b>
                {[["Lead", leads], ["Staff", staff]].map(([label, list]) => (list as ApiRecord[]).length ? (
                  <div key={label as string}><small>{label as string}</small><ul>{(list as ApiRecord[]).map((person) => <li key={String(person.id)}><span className={s.avatar} aria-hidden="true">{String(person.nama || "?").slice(0, 1).toUpperCase()}</span><span>{String(person.nama)}{isBlocked(person) ? <span className="text-[var(--red)]"> · blocked</span> : null}<em>{String(person.email)}</em></span></li>)}</ul></div>
                ) : null)}
                {!members.length ? <p className={s.hint}>No members yet.</p> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TagList({ title, name, values, onChange, placeholder, addLabel }: { title: string; name: string; values: string[]; onChange: (next: string[]) => void; placeholder: string; addLabel: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft(""); };
  return (
    <section aria-label={title} className={s.card}>
      <div className={s.cardHead}><h3>{title}</h3><span className={s.count}>{values.length}</span></div>
      <ul className={s.chips}>
        {values.map((value) => <li className={s.chipItem} key={value}><input name={name} type="hidden" value={value} /><span>{value}</span><button aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))} type="button"><i className="ti ti-x" aria-hidden="true" /></button></li>)}
        {!values.length ? <li className={s.hint}>Nothing yet.</li> : null}
      </ul>
      <div className={s.addForm}>
        <label className={s.grow}><span className="sr-only">{placeholder}</span><input className={s.input} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={placeholder} value={draft} /></label>
        <Button onClick={add} size="sm" type="button" variant="outline">{addLabel}</Button>
      </div>
    </section>
  );
}

function CompetitorIntelLists({ categories, targetAudience }: { categories: string[]; targetAudience: string[] }) {
  const [cats, setCats] = useState(categories);
  const [audiences, setAudiences] = useState(targetAudience);
  const dirty = cats.join("|") !== categories.join("|") || audiences.join("|") !== targetAudience.join("|");
  return (
    <form className={s.stack} onSubmit={submitTo(saveCompetitorIntelListsAction, { success: "Competitor lists saved.", failure: "Could not save the competitor lists." })}>
      <div className={s.twoCols}>
        <TagList addLabel="Add category" name="category" onChange={setCats} placeholder="New product category…" title="Competitor product categories" values={cats} />
        <TagList addLabel="Add audience" name="target_audience" onChange={setAudiences} placeholder="New target audience…" title="Competitor target audiences" values={audiences} />
      </div>
      <div className={s.saveBar}><span className={s.hint}>{dirty ? "You have unsaved changes." : "All changes saved."}</span><Button disabled={!dirty} type="submit">Save competitor lists</Button></div>
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
  agentTokens = [],
  initialTab,
  initialSection,
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
  /** null: the agent_tokens table is not there yet (migration 027 not run). */
  agentTokens?: AgentTokenRow[] | null;
  initialTab?: string;
  initialSection?: string;
}) {
  const sections = SETTINGS_SECTIONS.filter((section) => isAdmin || !("adminOnly" in section));
  const startTab = isSettingsSection(initialTab) && sections.some((section) => section.id === initialTab) ? initialTab : sections[0].id;
  const [tab, setTabState] = useState<SettingsSectionId>(startTab);
  const [ticketTab, setTicketTab] = useState<TicketSetupSectionId>(TICKET_SETUP_SECTIONS.some((section) => section.id === initialSection) ? initialSection as TicketSetupSectionId : "divisions");
  // Keep the address in step with the open section so it can be bookmarked or shared.
  function setTab(next: SettingsSectionId, sub?: TicketSetupSectionId) {
    setTabState(next);
    if (sub) setTicketTab(sub);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    if (next === "tickets") url.searchParams.set("section", sub || ticketTab); else url.searchParams.delete("section");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }
  // Search result opened: open the section that holds the record; its list then shows it.
  useRecordFocus((id) => {
    const has = (rows: ApiRecord[]) => rows.some((row) => String(row.id) === id);
    if (has(divisions)) setTab("tickets", "divisions");
    else if (has(people)) setTab("tickets", "people");
    else if (has(types)) setTab("tickets", "types");
    else if (has(platforms) || has(categories)) setTab("customer-knowledge");
    else if (has(klasifikasi)) setTab("product-classes");
    else if (has(masterProduk)) setTab("product-mapping");
    else if (has(ctaOptions)) setTab("carousel-ctas");
    else if (has(linkTemplates)) setTab("link-templates");
  });
  const hidden = new Set(hiddenSlugs(settings));
  const labels = menuLabelMaps(settings);
  const sectionNames = [...new Set(pages.map((page) => page.section))];
  const ciCategories = stringListValue(settings, "ci_product_categories");
  const ciTargetAudience = stringListValue(settings, "ci_target_audience");

  const current = sections.find((section) => section.id === tab) || sections[0];
  const groups: Array<[string, typeof sections]> = [["Workspace", sections.filter((section) => WORKSPACE.has(section.id))], ["Module lists", sections.filter((section) => !WORKSPACE.has(section.id))]];

  return (
    <div className={s.page}>
      <header className={s.head}>
        <span className={s.eyebrow}>Settings</span>
        <h1>Settings</h1>
        <p>Menus, people and the lists other modules use.</p>
      </header>
      <div className={s.layout}>
        <nav aria-label="Settings sections" className={s.nav}>
          {groups.map(([label, items]) => (
            <div className={s.navGroup} key={label}>
              <span className={s.navLabel}>{label}</span>
              {items.map((section) => (
                <button aria-current={tab === section.id ? "page" : undefined} className={tab === section.id ? s.navItemOn : s.navItem} key={section.id} onClick={() => setTab(section.id)} type="button">
                  <i className={`ti ${SECTION_META[section.id].icon}`} aria-hidden="true" /><span>{section.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <section aria-labelledby="settings-title" className={s.content}>
          <div className={s.contentHead}>
            <span className={s.contentIcon} aria-hidden="true"><i className={`ti ${SECTION_META[current.id].icon}`} /></span>
            <div><h2 id="settings-title">{current.label}</h2><p>{SECTION_META[current.id].description}</p></div>
          </div>

          {tab === "product-mapping" ? <RecordManager definitionKey="master_produk" rows={masterProduk} /> : null}

          {tab === "tickets" ? (
            <div className={s.stack}>
              <div className={s.subTabs} role="tablist" aria-label="Ticket setup">
                {TICKET_SETUP_SECTIONS.map((section) => <button aria-selected={ticketTab === section.id} className={ticketTab === section.id ? s.subTabOn : s.subTab} key={section.id} onClick={() => setTab("tickets", section.id)} role="tab" type="button">{section.label}</button>)}
              </div>
              {ticketTab === "divisions" ? <RecordManager definitionKey="tkt_divisi" rows={divisions} /> : null}
              {ticketTab === "people" ? <RecordManager definitionKey="tkt_people" rows={people} /> : null}
              {ticketTab === "types" ? <RecordManager definitionKey="tkt_types" rows={types} /> : null}
              {ticketTab === "flow" ? <TicketStatusEmailPanel divisions={divisions} people={people} /> : null}
            </div>
          ) : null}

          {tab === "customer-knowledge" ? <CustomerKnowledgeMasterPanel categories={categories} platforms={platforms} /> : null}

          {tab === "menu" ? (
            <div className={s.stack}>
              <form className={s.card} onSubmit={submitTo(saveMenuVisibilityAction, { success: "Menu visibility saved.", failure: "Could not save the menu visibility." })}>
                <div className={s.cardHead}><h3>Sidebar modules</h3><HelpTip label="About sidebar modules">Hidden modules stay reachable by their address; this only changes what the sidebar shows.</HelpTip></div>
                {sectionNames.map((section) => (
                  <fieldset className={s.fieldset} key={section}>
                    <legend>{section}</legend>
                    <div className={s.toggleGrid}>
                      {pages.filter((page) => page.section === section).map((page) => (
                        <label className={s.toggle} key={page.slug}>
                          <input name="all_slug" type="hidden" value={page.slug} />
                          <i className={`ti ${page.icon}`} aria-hidden="true" /><span>{page.title}</span>
                          <input className={s.switch} defaultChecked={!hidden.has(page.slug)} name="visible_slug" role="switch" type="checkbox" value={page.slug} />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <div className={s.saveRow}><Button type="submit">Save menu visibility</Button></div>
              </form>
              <form className={s.card} onSubmit={submitTo(saveMenuLabelsAction, { success: "Menu labels saved.", failure: "Could not save the menu labels." })}>
                <div className={s.cardHead}><h3>Sidebar labels</h3></div>
                <p className={s.hint}>Rename section headings and menu items shown in the sidebar.</p>
                {sectionNames.map((section) => (
                  <fieldset className={s.fieldset} key={section}>
                    <input name="all_section" type="hidden" value={section} />
                    <label className={s.sectionLabel}><span>Section</span><input className={s.input} defaultValue={labels.sections.get(section) ?? section} name={`section_label__${section}`} /></label>
                    <div className={s.labelGrid}>
                      {pages.filter((page) => page.section === section).map((page) => (
                        <label className={s.labelField} key={page.slug}>
                          <input name="all_slug" type="hidden" value={page.slug} />
                          <i className={`ti ${page.icon}`} aria-hidden="true" />
                          <input aria-label={`Label for ${page.title}`} className={s.input} defaultValue={labels.items.get(page.slug) ?? page.title} name={`item_label__${page.slug}`} />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <div className={s.saveRow}><Button type="submit">Save sidebar labels</Button></div>
              </form>
            </div>
          ) : null}

          {tab === "link-templates" ? <RecordManager definitionKey="event_link_templates" rows={linkTemplates} /> : null}
          {tab === "competitor-lists" ? <CompetitorIntelLists categories={ciCategories} targetAudience={ciTargetAudience} /> : null}
          {tab === "product-classes" ? <RecordManager definitionKey="product_klasifikasi" rows={klasifikasi} /> : null}
          {tab === "carousel-ctas" ? <RecordManager definitionKey="carousel_cta_options" rows={ctaOptions} /> : null}
          {tab === "users" && isAdmin ? <UserManagement users={users} /> : null}
          {tab === "claude" && isAdmin ? <ClaudeAccess tokens={agentTokens} /> : null}
        </section>
      </div>
    </div>
  );
}
