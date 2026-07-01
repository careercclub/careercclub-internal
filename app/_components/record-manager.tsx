"use client";

import Link from "next/link";
import type { ApiRecord } from "@/lib/api/_crud";
import type { ReactNode } from "react";
import { recordDefinitions, type ManagedField, type RecordDefinitionKey } from "@/lib/records/catalog";
import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { R2UploadField } from "./r2-upload-field";
import { usePagination } from "./ui-kit";
import styles from "../record-manager.module.css";

type RecordManagerProps = {
  definitionKey: RecordDefinitionKey;
  rows: ApiRecord[];
  links?: Array<{ href: string; label: string }>;
  tools?: ReactNode;
  fieldOptions?: Record<string, readonly string[]>;
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function inputValue(value: unknown, field: ManagedField) {
  if (value === null || value === undefined) return "";
  if (field.type === "json") return JSON.stringify(value);
  if ((field.type === "uuid-array" || field.type === "text-array") && Array.isArray(value)) return value.join(", ");
  if (value instanceof Date) return field.type === "time" ? value.toISOString().slice(11, 16) : value.toISOString().slice(0, 10);
  return String(value);
}

function Field({ field, value, options }: { field: ManagedField; value?: unknown; options?: readonly string[] }) {
  if (field.type === "checkbox") {
    return <label className={styles.checkField}><input name={field.name} type="checkbox" defaultChecked={value === true} /><span>{field.label}</span></label>;
  }

  if (field.type === "text-array") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <label className={styles.field}>
        <span>{field.label}</span>
        <select name={field.name} multiple required={field.required} defaultValue={selected}>
          {(options || field.options || []).map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  const common = { name: field.name, required: field.required, defaultValue: inputValue(value, field), placeholder: field.placeholder };
  return (
    <label className={styles.field}>
      <span>{field.label}</span>
      {field.storageArea ? <R2UploadField area={field.storageArea} defaultValue={String(common.defaultValue)} name={field.name} /> : field.type === "textarea" || field.type === "json" ? <textarea {...common} rows={3} /> : field.type === "select" ? (
        <select {...common}><option value="">Select...</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
      ) : <input {...common} type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"} />}
    </label>
  );
}

export function RecordManager({ definitionKey, rows, links = [], tools, fieldOptions = {} }: RecordManagerProps) {
  const definition = recordDefinitions[definitionKey];
  const { pageItems, page, setPage, totalPages } = usePagination(rows, 12);
  return (
    <section className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div><p>{definition.eyebrow}</p><h1>{definition.title}</h1><span>{definition.description}</span></div>
        <div className={styles.recordCount}><strong>{rows.length}</strong><span>records</span></div>
      </header>
      {links.length ? <nav className={styles.sectionNav}>{links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</nav> : null}
      {tools}
      <details className={styles.createPanel}>
        <summary><i className="ti ti-plus" aria-hidden="true" /> Add record</summary>
        <form action={createManagedRecord.bind(null, definitionKey)} className={styles.formGrid}>
          {definition.fields.map((field) => <Field field={field} key={field.name} options={fieldOptions[field.name]} />)}
          <button className={styles.primaryButton} type="submit">Save record</button>
        </form>
      </details>
      <div className={styles.dataPanel}>
        {rows.length ? <div className={styles.tableScroll}><table><thead><tr>{definition.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}<th>Actions</th></tr></thead><tbody>
          {pageItems.map((row) => { const id = String(row.id); return <tr key={id}>{definition.columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}<td><details className={styles.rowActions}><summary aria-label={`Edit ${id}`}><i className="ti ti-pencil" /></summary><div className={styles.rowEditor}><form action={updateManagedRecord.bind(null, definitionKey, id)} className={styles.formGrid}>{definition.fields.map((field) => <Field field={field} key={field.name} value={row[field.name]} options={fieldOptions[field.name]} />)}<button className={styles.primaryButton} type="submit">Save changes</button></form><form action={deleteManagedRecord.bind(null, definitionKey, id)}><button className={styles.dangerButton} type="submit">Delete record</button></form></div></details></td></tr>; })}
        </tbody></table></div> : <div className={styles.emptyState}><i className="ti ti-database-off" /><strong>No records yet</strong><span>Add the first record when the VPS database is connected.</span></div>}
        {rows.length && totalPages > 1 ? <div className={styles.pagination}><button disabled={page <= 0} onClick={() => setPage(Math.max(0, page - 1))} type="button"><i className="ti ti-chevron-left" /></button><span>Page {page + 1} / {totalPages}</span><button disabled={page >= totalPages - 1} onClick={() => setPage(Math.min(totalPages - 1, page + 1))} type="button"><i className="ti ti-chevron-right" /></button></div> : null}
      </div>
    </section>
  );
}
