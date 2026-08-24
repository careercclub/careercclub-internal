"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ApiRecord } from "@/lib/api/_crud";
import styles from "../record-manager.module.css";

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type TokenClient = { requestAccessToken(): void };

type CachedToken = { accessToken: string; expiresAt: number };

let cachedToken: CachedToken | null = null;

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

export type GoogleCalendarPayload = {
  taskId?: string;
  ticketId?: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
  attendees?: string[];
};

export type GoogleCalendarResult = {
  id?: string;
  url?: string;
  operation?: "created" | "updated";
};

export function GoogleCalendarScript() {
  return <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />;
}

export function useGoogleCalendarAction(onDone?: (result: GoogleCalendarResult) => void) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch("/api/google-calendar/events", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { clientId?: string };
        if (active && response.ok) setClientId(result.clientId || "");
      })
      .catch(() => undefined)
      .finally(() => { if (active) setConfigurationLoaded(true); });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function submit(accessToken: string, payload: GoogleCalendarPayload) {
    try {
      const apiResponse = await fetch("/api/google-calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, ...payload }),
      });
      const result = await apiResponse.json() as GoogleCalendarResult & { error?: string; code?: string };
      if (!apiResponse.ok) {
        if (result.code === "GOOGLE_TOKEN_EXPIRED") cachedToken = null;
        throw new Error(result.error || "Calendar event could not be created.");
      }
      setMessage(result.operation === "updated" ? "Calendar event updated." : "Calendar event created.");
      router.refresh();
      onDone?.(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Calendar event could not be created.");
    } finally {
      setBusy(false);
    }
  }

  function run(payload: GoogleCalendarPayload) {
    setMessage("");
    if (!clientId || !window.google) {
      setMessage("Google Calendar is not configured or the Google script is unavailable.");
      return;
    }
    setBusy(true);
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      void submit(cachedToken.accessToken, payload);
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: async (response) => {
        if (!response.access_token) {
          setMessage(response.error_description || response.error || "Google authorization failed.");
          setBusy(false);
          return;
        }
        const lifetime = Math.max(Number(response.expires_in || 3600) - 60, 60);
        cachedToken = { accessToken: response.access_token, expiresAt: Date.now() + lifetime * 1000 };
        await submit(response.access_token, payload);
      },
    });
    client.requestAccessToken();
  }

  return { run, busy, message, clientId, configurationLoaded };
}

type Props = { tasks: ApiRecord[]; people: ApiRecord[]; recordType?: "task" | "ticket" };

export function GoogleCalendarTool({ tasks, people, recordType = "task" }: Props) {
  const { run, busy, message, clientId } = useGoogleCalendarAction();

  function createEvent(formData: FormData) {
    const taskId = String(formData.get("task_id") || "");
    const task = tasks.find((item) => String(item.id) === taskId);
    run({
      ...(recordType === "ticket" ? { ticketId: taskId } : { taskId }),
      title: String(task?.title || "CCC task"),
      description: String(task?.description || ""),
      start: String(formData.get("start") || ""),
      end: String(formData.get("end") || ""),
      attendees: formData.getAll("attendees").map(String),
    });
  }

  return (
    <details className={styles.createPanel}>
      <GoogleCalendarScript />
      <summary><i className="ti ti-calendar-plus" aria-hidden="true" /> Add {recordType} to Google Calendar</summary>
      <form action={createEvent} className={styles.formGrid}>
        <label className={styles.field}><span>{recordType === "ticket" ? "Ticket" : "Task"}</span><select name="task_id" required><option value="">Select...</option>{tasks.map((task) => <option key={String(task.id)} value={String(task.id)}>{String(task.title || task.id)}{task.gcal_added ? " (added)" : ""}</option>)}</select></label>
        <label className={styles.field}><span>Start</span><input name="start" type="datetime-local" required /></label>
        <label className={styles.field}><span>End</span><input name="end" type="datetime-local" required /></label>
        <fieldset className={styles.checkList}><legend>Invite people</legend>{people.filter((person) => person.email).map((person) => <label key={String(person.id)}><input name="attendees" type="checkbox" value={String(person.email)} /><span>{String(person.nama || person.email)}</span></label>)}</fieldset>
        <button className={styles.primaryButton} disabled={busy || !clientId} type="submit">{busy ? "Authorizing..." : "Create event"}</button>
        {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
      </form>
    </details>
  );
}
