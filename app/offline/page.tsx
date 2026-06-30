import Link from "next/link";
import styles from "./offline.module.css";

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <span>CCC Internal</span>
        <h1>You are offline</h1>
        <p>Reconnect to load current tickets and operational data. Authenticated pages are never served from a stale cache.</p>
        <Link href="/dashboard">Try again</Link>
      </section>
    </main>
  );
}
