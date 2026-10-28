import Link from "next/link";
import styles from "./offline.module.css";

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <span>CCC Internal</span>
        <h1>You are offline</h1>
        <p>This page has not been opened on this device in the last 7 days, so there is no saved copy to show. Pages you open while online can be read offline; Resources and Settings are never saved on the device.</p>
        <Link href="/dashboard">Try again</Link>
      </section>
    </main>
  );
}
