"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiRecord } from "@/lib/api/_crud";
import styles from "../record-manager.module.css";

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken(): void };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(input: {
            client_id: string;
            scope: string;
            callback(response: TokenResponse): void;
          }): TokenClient;
        };
      };
    };
  }
}

type Props = { tasks: ApiRecord[]; people: ApiRecord[] };

export function GoogleCalendarTool({ tasks, people }: Props) {
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData, accessToken: string) {
    const taskId = String(formData.get("task_id") || "");
    const task = tasks.find((item) => String(item.id) === taskId);
    const attendees = formData.getAll("attendees").map(String);
    const response = await fetch("/api/google-calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        taskId,
        title: String(task?.title || "CCC task"),
        description: String(task?.description || ""),
        start: String(formData.get("start") || ""),
        end: String(formData.get("end") || ""),
        attendees,
      }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Calendar event could not be created.");
    setMessage("Calendar event created and task marked as synchronized.");
    router.refresh();
  }

  function createEvent(formData: FormData) {
    setMessage("");
    if (!clientId || !window.google) {
      setMessage("Google Calendar is not configured or the Google script is unavailable.");
      return;
    }
    setBusy(true);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: async (response) => {
        try {
          if (!response.access_token) throw new Error(response.error || "Google authorization failed.");
          await submit(formData, response.access_token);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Calendar event could not be created.");
        } finally {
          setBusy(false);
        }
      },
    });
    client.requestAccessToken();
  }

  return (
    <details className={styles.createPanel}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <summary><i className="ti ti-calendar-plus" aria-hidden="true" /> Add task to Google Calendar</summary>
      <form action={createEvent} className={styles.formGrid}>
        <label className={styles.field}><span>Task</span><select name="task_id" required><option value="">Select...</option>{tasks.map((task) => <option key={String(task.id)} value={String(task.id)}>{String(task.title || task.id)}{task.gcal_added ? " (added)" : ""}</option>)}</select></label>
        <label className={styles.field}><span>Start</span><input name="start" type="datetime-local" required /></label>
        <label className={styles.field}><span>End</span><input name="end" type="datetime-local" required /></label>
        <fieldset className={styles.checkList}><legend>Invite people</legend>{people.filter((person) => person.email).map((person) => <label key={String(person.id)}><input name="attendees" type="checkbox" value={String(person.email)} /><span>{String(person.nama || person.email)}</span></label>)}</fieldset>
        <button className={styles.primaryButton} disabled={busy || !clientId} type="submit">{busy ? "Authorizing..." : "Create event"}</button>
        {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
      </form>
    </details>
  );
}
