"use client";

import type { ApiRecord } from "@/lib/api/_crud";
import { useState } from "react";
import { StorageImage } from "./storage-image";
import styles from "../record-manager.module.css";

type Workspace = { profiles: ApiRecord[]; snapshots: ApiRecord[]; flags: ApiRecord[]; products: ApiRecord[]; prices: ApiRecord[] };

export function CompetitorTools({ workspace }: { workspace: Workspace }) {
  const [query, setQuery] = useState("");
  const profiles = workspace.profiles.filter((profile) => !query || `${profile.name} ${profile.category} ${profile.niche}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.toolStack}><div className={styles.metricStrip}><div><strong>{workspace.profiles.length}</strong><span>competitors</span></div><div><strong>{workspace.products.length}</strong><span>products</span></div><div><strong>{workspace.prices.length}</strong><span>price observations</span></div><div><strong>{workspace.flags.length}</strong><span>intelligence flags</span></div></div><div className={styles.filterBar}><input placeholder="Search competitors" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className={styles.competitorGrid}>{profiles.map((profile) => { const id = String(profile.id); const products = workspace.products.filter((product) => String(product.competitor_id) === id); const snapshots = workspace.snapshots.filter((snapshot) => String(snapshot.competitor_id) === id); const flags = workspace.flags.filter((flag) => String(flag.competitor_id) === id); return <article key={id}>{profile.logo_url ? <StorageImage objectKey={String(profile.logo_url)} label={String(profile.name || "Competitor")} /> : null}<div><header><strong>{String(profile.name || "Untitled")}</strong><span>{String(profile.threat_level || "unrated")}</span></header><p>{String(profile.niche || profile.target_audience || "No positioning notes")}</p><footer><span>{products.length} products</span><span>{snapshots.length} snapshots</span><span>{flags.length} flags</span></footer></div></article>; })}</div></div>;
}
