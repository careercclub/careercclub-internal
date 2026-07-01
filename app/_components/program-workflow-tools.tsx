import type { ApiRecord } from "@/lib/api/_crud";
import { duplicateProgramAction, repairProgramTicketLinksAction } from "@/app/actions/program-actions";
import { GoogleCalendarTool } from "./google-calendar-tool";
import styles from "../record-manager.module.css";

type Props = { events: ApiRecord[]; tasks: ApiRecord[]; people: ApiRecord[] };

export function ProgramWorkflowTools({ events, tasks, people }: Props) {
  const eventNames = new Map(events.map((event) => [String(event.id), String(event.nama || "Untitled program")]));
  return (
    <div className={styles.toolGrid}>
      <details className={styles.createPanel}>
        <summary><i className="ti ti-copy" aria-hidden="true" /> Duplicate program</summary>
        <form action={duplicateProgramAction} className={styles.formGrid}>
          <label className={styles.field}><span>Source program</span><select name="event_id" required><option value="">Select...</option>{events.map((event) => <option key={String(event.id)} value={String(event.id)}>{String(event.nama || event.id)}</option>)}</select></label>
          <label className={styles.field}><span>New name</span><input name="name" required /></label>
          <label className={styles.field}><span>New date</span><input name="date" type="date" required /></label>
          <fieldset className={styles.checkList}><legend>Tasks to copy (none selected copies all)</legend>{tasks.map((task) => <label key={String(task.id)}><input name="task_ids" type="checkbox" value={String(task.id)} /><span>{eventNames.get(String(task.project_id)) || "Unassigned"}: {String(task.title || "Untitled")}</span></label>)}</fieldset>
          <button className={styles.primaryButton} type="submit">Duplicate program</button>
        </form>
      </details>
      <details className={styles.createPanel}>
        <summary><i className="ti ti-link" aria-hidden="true" /> Repair task-ticket links</summary>
        <form action={repairProgramTicketLinksAction} className={styles.toolForm}>
          <p>Creates missing linked tickets and clears orphaned ticket references.</p>
          <button className={styles.primaryButton} type="submit">Run repair</button>
        </form>
      </details>
      <GoogleCalendarTool people={people} tasks={tasks} />
    </div>
  );
}
