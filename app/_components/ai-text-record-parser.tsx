"use client";

import { createManagedRecord } from "@/app/actions/record-actions";
import { notify, notifyError } from "@/app/_components/app-dialog";
import type { RecordDefinitionKey } from "@/lib/records/catalog";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import styles from "./ai-text-record-parser.module.css";

type ParserKind = "ticket" | "partnership" | "carousel" | "task";
type ParserField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "select";
  options?: string[];
  required?: boolean;
};

type Props = {
  definitionKey: RecordDefinitionKey;
  fields: ParserField[];
  kind: ParserKind;
  /** What gets saved, in lower case ("partner", "ticket"). Drives the save label: "Add partner". */
  noun: string;
  title?: string;
};

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function AiTextRecordParser({ definitionKey, fields, kind, noun, title = "Add with AI" }: Props) {
  const router = useRouter();
  const idPrefix = useId();
  const [source, setSource] = useState("");
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState("");
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  async function parse() {
    if (!source.trim() || parsing) return;
    setParsing(true);
    setParseError("");
    try {
      const response = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text: source }),
      });
      const result = await response.json().catch(() => ({})) as { data?: Record<string, unknown>; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "The AI could not read that text. Try adding more detail.");
      setValues(Object.fromEntries(fields.map((field) => [field.name, displayValue(result.data?.[field.name])])));
      setInvalid([]);
    } catch (error) {
      setParseError(error instanceof Error && error.message ? error.message : "The AI could not read that text.");
    } finally {
      setParsing(false);
    }
  }

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...(current || {}), [name]: value }));
    if (value.trim()) setInvalid((current) => current.filter((item) => item !== name));
  }

  function clear() {
    setValues(null);
    setInvalid([]);
    setParseError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || saving) return;
    const missing = fields.filter((field) => field.required && !(values[field.name] || "").trim()).map((field) => field.name);
    setInvalid(missing);
    if (missing.length) {
      document.getElementById(fieldId(missing[0]))?.focus();
      return;
    }
    setSaving(true);
    try {
      await createManagedRecord(definitionKey, new FormData(event.currentTarget));
      notify(`${capitalise(noun)} added.`);
      setSource("");
      clear();
      router.refresh();
    } catch (error) {
      notifyError(error, `Could not add the ${noun}. Nothing was saved.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className={styles.panel}>
      <summary>
        <span className={styles.icon} aria-hidden="true"><i className="ti ti-sparkles" /></span>
        <span className={styles.heading}>
          <strong>{title}</strong>
          <small>Paste a chat, email or notes. AI fills in the {noun} for you to check.</small>
        </span>
        <i className={`ti ti-chevron-down ${styles.chevron}`} aria-hidden="true" />
      </summary>
      <div className={styles.body}>
        <label className={styles.field} htmlFor={fieldId("source")}>
          <span>Text for AI</span>
          <textarea id={fieldId("source")} rows={4} value={source} placeholder="e.g. Met Rina from PT Maju Jaya today, they want an MT program for 20 people…" onChange={(event) => setSource(event.target.value)} />
        </label>
        <div className={styles.parseRow}>
          <button className={styles.parseButton} disabled={parsing || !source.trim()} onClick={parse} type="button">
            <i className="ti ti-sparkles" aria-hidden="true" /> {parsing ? "Reading…" : values ? "Parse again" : "Parse with AI"}
          </button>
          {parseError ? <p className={styles.error} role="alert">{parseError}</p> : !values ? <p className={styles.hint}>The form appears here once the AI has read the text.</p> : null}
        </div>
        {values ? (
          <form className={styles.form} noValidate onSubmit={save}>
            <p className={styles.step}><i className="ti ti-checklist" aria-hidden="true" /> Check every field, then add the {noun}.</p>
            <div className={styles.grid}>
              {[...fields.filter((field) => field.type !== "textarea"), ...fields.filter((field) => field.type === "textarea")].map((field) => {
                const isInvalid = invalid.includes(field.name);
                const common = { id: fieldId(field.name), name: field.name, required: field.required, "aria-invalid": isInvalid || undefined, value: values[field.name] || "" };
                return (
                  <label className={`${styles.field} ${field.type === "textarea" ? styles.wide : ""}`} htmlFor={common.id} key={field.name}>
                    <span>{field.label}{field.required ? <b className={styles.req} aria-hidden="true"> *</b> : null}</span>
                    {field.type === "textarea" ? <textarea {...common} rows={3} onChange={(event) => setValue(field.name, event.target.value)} />
                      : field.type === "select" ? <select {...common} onChange={(event) => setValue(field.name, event.target.value)}><option value="">Select {field.label.toLowerCase()}</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
                        : <input {...common} type={field.type || "text"} onChange={(event) => setValue(field.name, event.target.value)} />}
                    {isInvalid ? <small className={styles.fieldError}>Fill in {field.label.toLowerCase()}.</small> : null}
                  </label>
                );
              })}
            </div>
            <footer className={styles.footer}>
              <button className={styles.ghostButton} disabled={saving} onClick={clear} type="button">Clear form</button>
              <button className={styles.saveButton} disabled={saving} type="submit">{saving ? "Adding…" : `Add ${noun}`}</button>
            </footer>
          </form>
        ) : null}
      </div>
    </details>
  );
}
