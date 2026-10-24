"use client";

import Link from "next/link";
import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordDefinitions, type ManagedField, type RecordDefinitionKey } from "@/lib/records/catalog";
import { ITEM_NOUN, addTag, asTagList, displayLabel, fieldKind, planForm, plural } from "@/lib/records/form-plan";
import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { R2UploadField } from "./r2-upload-field";
import { usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import { notify, notifyError } from "./app-dialog";
import { guard } from "./safe-action";
import s from "./page-kit.module.css";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import styles from "../record-manager.module.css";
import { DateInput, formatDayMonthYear, TimeInput } from "./date-input";
import { formatRupiah, MoneyInput } from "./money-input";

type RecordManagerProps = {
  definitionKey: RecordDefinitionKey;
  rows: ApiRecord[];
  links?: Array<{ href: string; label: string }>;
  tools?: ReactNode;
  fieldOptions?: Record<string, readonly string[]>;
  /** Rendered inside a module page's "Manage data" view: that page already has the heading. */
  embedded?: boolean;
};

type Option = { value: string; label: string };
type OptionsState = { status: "idle" | "loading" | "done" | "error"; options: Record<string, Option[]> };

const PAGE_SIZE = 12;

function displayValue(value: unknown, field?: ManagedField) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field?.type === "money") return formatRupiah(value) || "-";
  if (value instanceof Date) return formatDayMonthYear(value.toISOString().slice(0, 10));
  if (field?.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(value))) return formatDayMonthYear(String(value));
  if (Array.isArray(value)) return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ") || "-";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
}

function inputValue(value: unknown, field: ManagedField) {
  if (value === null || value === undefined) return "";
  if (field.type === "json") return JSON.stringify(value, null, 2);
  if ((field.type === "uuid-array" || field.type === "text-array") && Array.isArray(value)) return value.join(", ");
  if (value instanceof Date) return field.type === "time" ? value.toISOString().slice(11, 16) : value.toISOString().slice(0, 10);
  const text = String(value);
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  return text;
}

function systemValue(value: unknown, field: ManagedField) {
  if (value === null || value === undefined || value === "") return "";
  if (field.type !== "json") return inputValue(value, field);
  if (typeof value === "string") {
    try { JSON.parse(value); return value; } catch { return JSON.stringify(value); }
  }
  return JSON.stringify(value);
}

function idList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return typeof value === "string" && value.trim() ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function singular(label: string) {
  const lower = label.toLowerCase();
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  // "status", "address", "bus" are already singular.
  if (/(us|ss|is)$/.test(lower)) return lower;
  return lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

/** Reference: names in a dropdown; the stored id is always kept even if it is not (yet) in the list. */
function ReferenceSelect({ field, value, options, loading }: { field: ManagedField; value?: unknown; options: Option[]; loading: boolean }) {
  const current = value === null || value === undefined ? "" : String(value);
  const known = options.some((option) => option.value === current);
  return (
    <select defaultValue={current} key={`${current}:${options.length}`} name={field.name} required={field.required}>
      <option value="">{loading ? "Loading names…" : `Select ${singular(displayLabel(field.label))}…`}</option>
      {current && !known ? <option value={current}>{loading ? "Current selection" : "Current selection (not in list)"}</option> : null}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

/** Several references: checkboxes of names, submitted as "id, id" (the uuid-array format). */
function ReferenceChecklist({ field, value, options, loading }: { field: ManagedField; value?: unknown; options: Option[]; loading: boolean }) {
  const [selected, setSelected] = useState<string[]>(() => idList(value));
  const unknown = selected.filter((id) => !options.some((option) => option.value === id));
  return (
    <div className={styles.checkList}>
      <input name={field.name} type="hidden" value={selected.join(", ")} />
      {loading && !options.length ? <small>Loading names…</small> : null}
      {!loading && !options.length && !unknown.length ? <small>Nothing to choose yet.</small> : null}
      {[...options, ...unknown.map((id) => ({ value: id, label: "Current selection (not in list)" }))].map((option) => (
        <label key={option.value}>
          <input checked={selected.includes(option.value)} onChange={(event) => setSelected((list) => (event.target.checked ? [...list, option.value] : list.filter((id) => id !== option.value)))} type="checkbox" />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/** JSON list of plain text edited as chips; submitted as JSON. */
function TagEditor({ field, value }: { field: ManagedField; value?: unknown }) {
  const [list, setList] = useState<string[]>(() => asTagList(value) || []);
  const [draft, setDraft] = useState("");
  const item = singular(displayLabel(field.label));
  function add() { setList((current) => addTag(current, draft)); setDraft(""); }
  return (
    <div className={styles.tagEditor}>
      <input name={field.name} type="hidden" value={list.length ? JSON.stringify(list) : ""} />
      {list.length ? <div className={styles.tagList}>{list.map((tag) => <span key={tag}>{tag}<button aria-label={`Remove ${item} ${tag}`} onClick={() => setList((current) => current.filter((entry) => entry !== tag))} type="button">×</button></span>)}</div> : null}
      <div className={styles.tagInputRow}>
        <input onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={`Type a ${item} and press Enter`} value={draft} />
        <button className={styles.secondaryButton} disabled={!draft.trim()} onClick={add} type="button"><span>Add {item}</span></button>
      </div>
    </div>
  );
}

function Field({ definitionKey, field, value, options, optionsState }: { definitionKey: string; field: ManagedField; value?: unknown; options?: readonly string[]; optionsState: OptionsState }) {
  const kind = fieldKind(definitionKey, field);
  const label = displayLabel(field.label);
  const caption = <span>{label}{field.required ? <b className={styles.requiredMark}> required</b> : null}</span>;

  if (kind === "system") {
    // Re-submit exactly what is stored. A legacy plain-text value is wrapped as JSON so saving
    // the rest of the form can never fail on a field the person cannot see.
    return <input name={field.name} type="hidden" defaultValue={systemValue(value, field)} />;
  }

  if (field.type === "checkbox") {
    return <label className={styles.checkField}><input name={field.name} type="checkbox" defaultChecked={value === true} /><span>{label}</span></label>;
  }

  if (kind === "reference" || kind === "references") {
    const list = optionsState.options[field.name] || [];
    const loading = optionsState.status === "loading" || optionsState.status === "idle";
    // A checklist holds its own labels, so it is a fieldset: a <label> around it would make a
    // click on the caption toggle the first checkbox.
    return kind === "reference" ? (
      <label className={styles.field}>{caption}<ReferenceSelect field={field} loading={loading} options={list} value={value} /></label>
    ) : (
      <fieldset className={`${styles.field} ${styles.fieldGroup}`}><legend>{caption}</legend><ReferenceChecklist field={field} loading={loading} options={list} value={value} /></fieldset>
    );
  }

  if (kind === "tags" && asTagList(value) !== null) {
    return <div className={`${styles.field} ${styles.wideField}`}>{caption}<TagEditor field={field} value={value} /></div>;
  }

  if (field.type === "text-array") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <fieldset className={`${styles.field} ${styles.checkList}`}>
        <legend>{caption}</legend>
        {(options || field.options || []).length ? null : <small>No choices set up yet.</small>}
        {(options || field.options || []).map((option) => <label key={option}><input defaultChecked={selected.includes(option)} name={field.name} type="checkbox" value={option} /><span>{option}</span></label>)}
      </fieldset>
    );
  }

  const common = { name: field.name, required: field.required, defaultValue: inputValue(value, field), placeholder: field.placeholder };
  const wide = field.type === "textarea" || field.type === "json";
  return (
    <label className={`${styles.field} ${wide ? styles.wideField : ""}`}>
      {caption}
      {field.storageArea ? <R2UploadField area={field.storageArea} defaultValue={String(common.defaultValue)} name={field.name} /> : wide ? <textarea {...common} rows={field.type === "json" ? 5 : 3} spellCheck={field.type !== "json"} /> : field.type === "select" ? (
        <select {...common}><option value="">{`Select ${singular(label)}…`}</option>{(options || field.options)?.map((option) => <option key={option}>{option}</option>)}</select>
      ) : field.type === "date" ? <DateInput {...common} /> : field.type === "time" ? <TimeInput {...common} /> : field.type === "money" ? <MoneyInput {...common} /> : <input {...common} type={field.type === "number" ? "number" : "text"} />}
    </label>
  );
}

/** One form layout for add and edit: required first, optional folded, advanced folded, system hidden. */
function RecordForm({ definitionKey, row, fieldOptions, optionsState, submitLabel, action }: { definitionKey: RecordDefinitionKey; row?: ApiRecord; fieldOptions: Record<string, readonly string[]>; optionsState: OptionsState; submitLabel: string; action: (formData: FormData) => void }) {
  const definition = recordDefinitions[definitionKey];
  const plan = planForm(definitionKey, definition.fields as readonly ManagedField[]);
  const filled = (fields: ManagedField[]) => fields.filter((field) => { const value = row?.[field.name]; return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && !value.length); }).length;
  const render = (field: ManagedField) => <Field definitionKey={definitionKey} field={field} key={field.name} optionsState={optionsState} options={fieldOptions[field.name]} value={row?.[field.name]} />;
  return (
    // onSubmit rather than a form action: a form action clears every field when it runs,
    // so a failed save would throw away what was typed.
    <form className={styles.recordForm} onSubmit={(event) => { event.preventDefault(); action(new FormData(event.currentTarget)); }}>
      <div className={styles.formGrid}>{plan.main.map(render)}</div>
      {plan.more.length ? (
        <details className={styles.moreFields}>
          <summary>More fields <small>{plan.more.length} optional{row && filled(plan.more) ? ` · ${filled(plan.more)} filled` : ""}</small></summary>
          <div className={styles.formGrid}>{plan.more.map(render)}</div>
        </details>
      ) : null}
      {plan.advanced.length ? (
        <details className={styles.moreFields}>
          <summary>Advanced <small>{plan.advanced.length} technical{row && filled(plan.advanced) ? ` · ${filled(plan.advanced)} filled` : ""}</small></summary>
          <p className={styles.hint}>Usually filled automatically by the module page. Change only if you know the format.</p>
          <div className={styles.formGrid}>{plan.advanced.map(render)}</div>
        </details>
      ) : null}
      {plan.system.map(render)}
      <div className={styles.formActions}><button className={styles.primaryButton} type="submit">{submitLabel}</button></div>
    </form>
  );
}

function DeleteRecord({ definitionKey, id, noun }: { definitionKey: RecordDefinitionKey; id: string; noun: string }) {
  const [confirming, setConfirming] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) cancel.current?.focus(); }, [confirming]);
  if (!confirming) {
    return <div className={styles.formActions}><button className={styles.dangerButton} onClick={() => setConfirming(true)} type="button">Delete {noun}</button></div>;
  }
  return (
    <form className={styles.confirmDelete} onSubmit={(event) => { event.preventDefault(); void guard(() => deleteManagedRecord(definitionKey, id), `Could not delete the ${noun}.`); }} role="alertdialog" aria-label={`Confirm delete ${noun}`}>
      <span>Delete this {noun}? This cannot be undone.</span>
      <button className={styles.secondaryButton} onClick={() => setConfirming(false)} ref={cancel} type="button"><span>Cancel</span></button>
      <button className={styles.dangerButton} type="submit">Yes, delete {noun}</button>
    </form>
  );
}

export function RecordManager({ definitionKey, rows, links = [], tools, fieldOptions = {}, embedded = false }: RecordManagerProps) {
  const [editingId, setEditingId] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const editingRow = editingId ? rows.find((row) => String(row.id) === editingId) : undefined;
  const definition = recordDefinitions[definitionKey];
  const noun = ITEM_NOUN[definitionKey] || "record";
  const fields = definition.fields as readonly ManagedField[];
  const searchable = rows.length > PAGE_SIZE;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.entries(row).some(([key, value]) => key !== "id" && value !== null && value !== undefined && String(typeof value === "object" ? JSON.stringify(value) : value).toLowerCase().includes(q)));
  }, [rows, query]);
  const { pageItems, page, setPage, totalPages } = usePagination(shown, PAGE_SIZE);
  const hasReferences = useMemo(() => fields.some((field) => ["reference", "references"].includes(fieldKind(definitionKey, field))), [definitionKey, fields]);
  const [optionsState, setOptionsState] = useState<OptionsState>({ status: hasReferences ? "idle" : "done", options: {} });

  // Names for id fields (dropdowns and table cells) come from one request per table page.
  useEffect(() => {
    if (!hasReferences) return;
    const controller = new AbortController();
    fetch(`/api/record-options?key=${encodeURIComponent(definitionKey)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((result: { options?: Record<string, Option[]> }) => setOptionsState({ status: "done", options: result.options || {} }))
      .catch(() => { if (!controller.signal.aborted) setOptionsState({ status: "error", options: {} }); });
    return () => controller.abort();
  }, [definitionKey, hasReferences]);

  // Search result opened: jump to the page holding the record; RecordFocus opens its editor.
  useRecordFocus((id) => {
    const index = rows.findIndex((row) => String(row.id) === id);
    if (index < 0) return;
    if (query) setQuery("");
    if (Math.floor(index / PAGE_SIZE) !== page) setPage(Math.floor(index / PAGE_SIZE));
  });

  const labelFor = useMemo(() => {
    const maps = Object.fromEntries(Object.entries(optionsState.options).map(([field, list]) => [field, new Map(list.map((option) => [option.value, option.label]))]));
    return (column: string, value: unknown) => {
      const map = maps[column];
      if (!map) return displayValue(value, definition.fields.find((field) => field.name === column));
      const ids = idList(value);
      if (!ids.length) return "-";
      return ids.map((id) => map.get(id) || "Unknown").join(", ");
    };
  }, [optionsState.options, definition]);

  const columnLabel = (column: string) => {
    const field = fields.find((item) => item.name === column);
    if (field) return displayLabel(field.label);
    const words = column.replaceAll("_", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  };

  return (
    <section className={styles.workspace}>
      {embedded ? (
        <div className={s.toolbar}>
          <b className={styles.embeddedCount}>{rows.length} {plural(noun, rows.length)}</b>
          <span className={styles.embeddedHint}>{definition.description}</span>
          <span className={s.spacer} />
          <button className={s.primary} onClick={() => setAdding(true)} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add {noun}</button>
        </div>
      ) : (
        <header className={s.head}>
          <div>
            <span className={s.eyebrow}>{definition.eyebrow}</span>
            <h1>{definition.title}</h1>
            <p>{rows.length} {plural(noun, rows.length)} · {definition.description}</p>
          </div>
          <div className={s.headActions}><button className={s.primary} onClick={() => setAdding(true)} type="button"><i className="ti ti-plus" aria-hidden="true" /> Add {noun}</button></div>
        </header>
      )}
      {links.length ? <nav aria-label="Related lists" className={s.pills}>{links.map((link) => <Link className={s.pill} href={link.href} key={link.href}>{link.label}</Link>)}</nav> : null}
      {tools}
      {searchable ? (
        <div className={s.toolbar}>
          <label className={s.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label={`Search ${plural(noun)}`} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder={`Search ${plural(noun)}`} value={query} /></label>
          {query ? <span className={s.muted}>{shown.length} of {rows.length}</span> : null}
        </div>
      ) : null}
      <Dialog onOpenChange={(open) => { if (!open) setAdding(false); }} open={adding}>
        {adding ? (
          <DialogContent className={styles.editDialog}>
            <DialogHeader className={styles.editDialogHeader}>
              <DialogTitle>Add {noun}</DialogTitle>
              <DialogDescription>{definition.title} · fields marked * are required</DialogDescription>
            </DialogHeader>
            <div className={styles.editDialogBody}>
              <RecordForm action={async (formData: FormData) => { try { await createManagedRecord(definitionKey, formData); setAdding(false); notify(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} added.`); } catch (error) { notifyError(error, `Could not add the ${noun}.`); } }} definitionKey={definitionKey} fieldOptions={fieldOptions} optionsState={optionsState} submitLabel={`Add ${noun}`} />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
      {optionsState.status === "error" ? <p className={styles.hint} role="status">Names could not be loaded. Lists show stored ids; try reloading the page.</p> : null}
      <div className={styles.dataPanel}>
        {shown.length ? <div className={styles.tableScroll}><table><thead><tr>{definition.columns.map((column) => <th key={column}>{columnLabel(column)}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {pageItems.map((row) => {
            const id = String(row.id);
            return (
              <tr data-record-id={id} key={id}>
                {definition.columns.map((column) => <td key={column}>{labelFor(column, row[column])}</td>)}
                <td>
                  <button aria-label={`Edit ${noun}`} className={styles.rowEditButton} data-record-open onClick={() => setEditingId(id)} title={`Edit ${noun}`} type="button"><i className="ti ti-pencil" aria-hidden="true" /></button>
                </td>
              </tr>
            );
          })}
        </tbody></table></div> : rows.length ? <div className={styles.emptyState}><i className="ti ti-search-off" aria-hidden="true" /><strong>No {plural(noun)} match “{query}”</strong><button className={s.ghost} onClick={() => setQuery("")} type="button">Clear search</button></div> : <div className={styles.emptyState}><i className="ti ti-database-off" aria-hidden="true" /><strong>No {plural(noun)} yet</strong><span>Click <b>Add {noun}</b> above to create the first one.</span></div>}
        {shown.length && totalPages > 1 ? <div className={styles.pagination}><button aria-label="Previous page" disabled={page <= 0} onClick={() => setPage(Math.max(0, page - 1))} type="button"><i className="ti ti-chevron-left" /></button><span>Page {page + 1} / {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages - 1} onClick={() => setPage(Math.min(totalPages - 1, page + 1))} type="button"><i className="ti ti-chevron-right" /></button></div> : null}
      </div>
      <Dialog onOpenChange={(open) => { if (!open) setEditingId(""); }} open={Boolean(editingRow)}>
        {editingRow ? (
          <DialogContent className={styles.editDialog}>
            <DialogHeader className={styles.editDialogHeader}>
              <DialogTitle>Edit {noun}</DialogTitle>
              <DialogDescription>{definition.title}</DialogDescription>
            </DialogHeader>
            <div className={styles.editDialogBody}>
              <RecordForm action={async (formData: FormData) => { try { await updateManagedRecord(definitionKey, String(editingRow.id), formData); setEditingId(""); } catch (error) { notifyError(error, `Could not save the ${noun}.`); } }} definitionKey={definitionKey} fieldOptions={fieldOptions} optionsState={optionsState} row={editingRow} submitLabel={`Save ${noun}`} />
              <DeleteRecord definitionKey={definitionKey} id={String(editingRow.id)} noun={noun} />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
