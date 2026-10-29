import s from "./loading.module.css";

// Shown the moment a menu link is clicked, while the server prepares the next page.
// Without it the old page just sat there for the whole server round-trip, which read
// as the app freezing for a few seconds. Next also prefetches this shell for visible
// links, so it appears instantly.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page" className={s.page} role="status">
      <div className={s.head}><span className={s.title} /><span className={s.line} /></div>
      <div className={s.tabs}><span /><span /><span /></div>
      <div className={s.grid}>{Array.from({ length: 6 }, (_, i) => <span className={s.card} key={i} />)}</div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
