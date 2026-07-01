"use client";

import { createManagedRecord } from "@/app/actions/record-actions";
import type { RecordDefinitionKey } from "@/lib/records/catalog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../record-manager.module.css";

type ParserKind = "ticket" | "partnership" | "carousel" | "voucher" | "task";
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
  title: string;
};

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function AiTextRecordParser({ definitionKey, fields, kind, title }: Props) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function parse() {
    if (!source.trim()) return;
    setBusy(true);
    setMessage("Parsing...");
    try {
      const response = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text: source }),
      });
      const result = await response.json() as { data?: Record<string, unknown>; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Text could not be parsed.");
      setValues(Object.fromEntries(fields.map((field) => [field.name, displayValue(result.data?.[field.name])])));
      setMessage("Parsed. Review every field before saving.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Text parsing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      await createManagedRecord(definitionKey, formData);
      setSource("");
      setValues({});
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <details className={styles.createPanel}><summary><i className="ti ti-sparkles" /> {title}</summary><div className={styles.toolStack}><label className={styles.field}><span>Operational text</span><textarea rows={5} value={source} onChange={(event) => setSource(event.target.value)} /></label><button className={styles.secondaryButton} disabled={busy || !source.trim()} onClick={parse} type="button">Parse with AI</button><form action={save} className={styles.formGrid}>{fields.map((field) => <label className={styles.field} key={field.name}><span>{field.label}</span>{field.type === "textarea" ? <textarea name={field.name} required={field.required} value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} /> : field.type === "select" ? <select name={field.name} required={field.required} value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}><option value="">Select</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input name={field.name} required={field.required} type={field.type || "text"} value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}</label>)}<button className={styles.primaryButton} disabled={busy} type="submit">Save parsed record</button></form>{message ? <p className={styles.formMessage}>{message}</p> : null}</div></details>;
}
