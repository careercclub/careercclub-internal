import { syncMetaAdsAction } from "@/app/actions/meta-ads-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import styles from "../record-manager.module.css";

export function MetaAdsTools({ rows }: { rows: ApiRecord[] }) {
  const boost = rows.filter((row) => row.ad_decision === "Boost").length;
  const pending = rows.filter((row) => !row.ad_decision || row.ad_decision === "Pending").length;
  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{rows.length}</strong><span>ad candidates</span></div><div><strong>{boost}</strong><span>boost</span></div><div><strong>{pending}</strong><span>pending review</span></div></div><form action={syncMetaAdsAction}><button className={styles.secondaryButton} type="submit"><i className="ti ti-refresh" /> Synchronize eligible evaluations</button></form></div>;
}
