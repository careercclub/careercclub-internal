"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FilterBar, Pill, StatCard, StatsGrid, filterFieldClass } from "./ui-kit";

type Tab = "dashboard" | "list" | "newsletter" | "company" | "manage";
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function list(value: unknown) { if (Array.isArray(value)) return value.map(String); if (typeof value === "string") { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch { } return value.split(/[;,|]/).map((item) => item.trim()).filter(Boolean); } return []; }
function date(value: unknown) { const parsed = new Date(String(value || "")); return Number.isFinite(parsed.getTime()) ? parsed : null; }
function week(value: Date) { return value.getDate() <= 7 ? 1 : value.getDate() <= 14 ? 2 : value.getDate() <= 21 ? 3 : 4; }
function frequency(rows: ApiRecord[], key: string) { const map = new Map<string, number>(); rows.forEach((row) => { const value = String(row[key] || "Unknown"); map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }

function DistributionBars({ data }: { data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, count]) => count));
  return <div className="grid gap-1.5">{data.map(([name, count]) => <div className="grid grid-cols-[110px_minmax(0,1fr)_36px] items-center gap-2 text-[10px]" key={name}><span className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">{name}</span><i className="block h-2 min-w-[2px] rounded bg-[var(--purple-mid)]" style={{ width: `${(count / max) * 100}%` }} /><strong className="text-right text-[10px]">{count}</strong></div>)}</div>;
}

export function MtVacancyTools({ rows, referenceDate, management }: { rows: ApiRecord[]; referenceDate: string; management: ReactNode }) {
  const now = useMemo(() => new Date(referenceDate), [referenceDate]); const router = useRouter(); const [tab, setTab] = useState<Tab>("dashboard"); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [query, setQuery] = useState(""); const [industry, setIndustry] = useState(""); const [month, setMonth] = useState(""); const [year, setYear] = useState(""); const [nlMonth, setNlMonth] = useState(now.getMonth()); const [nlYear, setNlYear] = useState(now.getFullYear()); const [nlWeek, setNlWeek] = useState(week(now)); const [nlIndustries, setNlIndustries] = useState<string[]>([]); const [output, setOutput] = useState<"wa" | "email">("wa");
  const industries = frequency(rows, "industry").map(([value]) => value); const years = [...new Set(rows.map((row) => String(row.year || "")).filter(Boolean))].sort().reverse();
  const active = useMemo(() => rows.filter((row) => String(row.status || "Active").toLowerCase() !== "closed" && (!date(row.deadline) || date(row.deadline)!.getTime() >= now.getTime())), [rows, now]);
  const filtered = useMemo(() => rows.filter((row) => (!query || `${row.company || ""} ${row.program || ""}`.toLowerCase().includes(query.toLowerCase())) && (!industry || row.industry === industry) && (!year || String(row.year) === year) && (!month || list(row.months).map(Number).includes(Number(month)))), [rows, query, industry, year, month]);
  const monthly = Array.from({ length: 12 }, (_, index) => rows.filter((row) => String(row.year) === String(now.getFullYear()) && list(row.months).map(Number).includes(index + 1)).length); const industryDist = frequency(rows, "industry"); const thisWeek = rows.filter((row) => { const created = date(row.created_at); return created && Math.abs(now.getTime() - created.getTime()) <= 7 * 86400000; }).length; const thisMonth = rows.filter((row) => list(row.months).map(Number).includes(now.getMonth() + 1) && String(row.year) === String(now.getFullYear())).length;
  const newsletterRows = rows.filter((row) => { const created = date(row.created_at); return created && created.getMonth() === nlMonth && created.getFullYear() === nlYear && week(created) === nlWeek && list(row.months).map(Number).includes(nlMonth + 1) && (!nlIndustries.length || nlIndustries.includes(String(row.industry))); });
  const newsletter = buildNewsletter(newsletterRows, nlMonth, nlWeek, nlIndustries);
  const companies = useMemo(() => { const map = new Map<string, { industry: string; programs: Map<string, ApiRecord[]> }>(); rows.forEach((row) => { const name = String(row.company || "Unknown"); const item = map.get(name) || { industry: String(row.industry || "Unknown"), programs: new Map() }; const program = String(row.program || "Untitled"); item.programs.set(program, [...(item.programs.get(program) || []), row]); map.set(name, item); }); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [rows]);
  async function importVacancies(formData: FormData) { setBusy(true); setMessage(""); try { const response = await fetch("/api/mt-vacancies/import", { method: "POST", body: formData }); const result = await response.json() as { inserted?: number; updated?: number; error?: string }; if (!response.ok) throw new Error(result.error || "Import failed."); setMessage(`Imported ${result.inserted || 0}; updated ${result.updated || 0}.`); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); } finally { setBusy(false); } }
  function copy() { navigator.clipboard.writeText(newsletter[output]).then(() => setMessage(`${output.toUpperCase()} newsletter copied.`)).catch(() => setMessage("Clipboard access was blocked.")); }

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="list">All vacancies</TabsTrigger>
            <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
            <TabsTrigger value="company">Company Intel</TabsTrigger>
            <TabsTrigger value="manage">Add &amp; manage</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button asChild size="sm" variant="outline"><Link href="/job-vacancy-mt/industries"><i className="ti ti-database" /> Industry master</Link></Button>
      </div>
      {tab === "dashboard" ? (
        <>
          <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
            <StatCard label="Total vacancies" value={rows.length} />
            <StatCard label="Added this week" value={thisWeek} />
            <StatCard label="Top industry" value={industryDist[0]?.[0] || "-"} />
            <StatCard label="Open this month" value={thisMonth} />
            <StatCard label="Active now" value={active.length} tone="var(--green)" />
          </StatsGrid>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="gap-2 p-4"><h3 className="text-xs font-bold">Vacancies open by month &middot; {now.getFullYear()}</h3><DistributionBars data={monthly.map((value, index) => [monthNames[index], value])} /></Card>
            <Card className="gap-2 p-4"><h3 className="text-xs font-bold">Industry distribution</h3><DistributionBars data={industryDist} /></Card>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {industryDist.map(([value, count]) => (
              <Card className="gap-1.5 p-3.5" key={value}>
                <div className="flex items-start justify-between gap-2"><strong className="text-[12px] font-semibold">{value}</strong><span className="text-[11px] text-muted-foreground">{count}</span></div>
                <p className="text-[11px] text-muted-foreground">{new Set(rows.filter((row) => row.industry === value).map((row) => String(row.company))).size} companies</p>
                <span className="text-[10px] text-muted-foreground">{rows.filter((row) => row.industry === value && list(row.months).map(Number).includes(now.getMonth() + 1)).length} open this month</span>
              </Card>
            ))}
          </div>
        </>
      ) : null}
      {tab === "list" ? (
        <>
          <FilterBar>
            <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or program" value={query} />
            <select className={filterFieldClass} onChange={(event) => setIndustry(event.target.value)} value={industry}><option value="">All industries</option>{industries.map((value) => <option key={value}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setMonth(event.target.value)} value={month}><option value="">All opening months</option>{monthNames.map((value, index) => <option key={value} value={index + 1}>{value}</option>)}</select>
            <select className={filterFieldClass} onChange={(event) => setYear(event.target.value)} value={year}><option value="">All years</option>{years.map((value) => <option key={value}>{value}</option>)}</select>
          </FilterBar>
          <VacancyTable rows={filtered} />
        </>
      ) : null}
      {tab === "newsletter" ? (
        <Card className="gap-3 p-5">
          <div><h2 className="text-sm font-bold">Newsletter generator</h2><p className="mt-1 text-[11px] text-muted-foreground">Filters by input week and includes only customer-facing career links.</p></div>
          <FilterBar>
            <select className={filterFieldClass} onChange={(event) => setNlMonth(Number(event.target.value))} value={nlMonth}>{monthNames.map((value, index) => <option key={value} value={index}>{value}</option>)}</select>
            <input className={filterFieldClass} min="2024" onChange={(event) => setNlYear(Number(event.target.value))} type="number" value={nlYear} />
            <select className={filterFieldClass} onChange={(event) => setNlWeek(Number(event.target.value))} value={nlWeek}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>Week {value}</option>)}</select>
            <details className="relative"><summary className={`${filterFieldClass} flex cursor-pointer items-center`}>{nlIndustries.length ? `${nlIndustries.length} industries` : "All industries"}</summary><div className="absolute z-10 mt-1 grid gap-1 rounded-lg border border-border bg-white p-2 text-xs shadow-md">{industries.map((value) => <label className="flex items-center gap-1.5" key={value}><input checked={nlIndustries.includes(value)} onChange={() => setNlIndustries((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} type="checkbox" />{value}</label>)}</div></details>
          </FilterBar>
          {newsletterRows.length ? (
            <>
              <Tabs onValueChange={(value) => setOutput(value as "wa" | "email")} value={output}>
                <TabsList variant="line"><TabsTrigger value="wa"><i className="ti ti-brand-whatsapp" /> WhatsApp</TabsTrigger><TabsTrigger value="email"><i className="ti ti-mail" /> Email</TabsTrigger></TabsList>
              </Tabs>
              <pre className="max-h-[420px] overflow-auto rounded-lg bg-[var(--bg)] p-3.5 text-[11px] whitespace-pre-wrap">{newsletter[output]}</pre>
              <Button onClick={copy} size="sm" variant="outline"><i className="ti ti-copy" /> Copy text</Button>
            </>
          ) : (
            <div className="grid place-items-center gap-1 py-10 text-center text-muted-foreground"><i className="ti ti-calendar-off text-2xl" /><strong className="text-foreground">No matching vacancies</strong><span className="text-xs">Change the week or industry selection.</span></div>
          )}
        </Card>
      ) : null}
      {tab === "company" ? (
        <>
          <FilterBar>
            <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or program" value={query} />
            <select className={filterFieldClass} onChange={(event) => setIndustry(event.target.value)} value={industry}><option value="">All industries</option>{industries.map((value) => <option key={value}>{value}</option>)}</select>
          </FilterBar>
          <div className="grid gap-3 md:grid-cols-2">
            {companies.filter(([company, item]) => (!query || `${company} ${[...item.programs.keys()].join(" ")}`.toLowerCase().includes(query.toLowerCase())) && (!industry || item.industry === industry)).map(([company, item]) => (
              <Card className="gap-2.5 p-4" key={company}>
                <div><strong className="text-[13px] font-bold">{company}</strong><div className="text-[11px] text-muted-foreground">{item.industry} &middot; {item.programs.size} program(s)</div></div>
                {[...item.programs.entries()].map(([program, history]) => {
                  const patterns = history.map((row) => list(row.months).map(Number).sort((a, b) => a - b).join(","));
                  const changed = patterns.some((value) => value !== patterns[0]);
                  return (
                    <section className="rounded-lg bg-[var(--bg)] p-2.5" key={program}>
                      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">{program}{changed ? <Badge className="rounded-full bg-[var(--amber-bg)] text-[var(--amber)]">Pattern changed</Badge> : null}</h3>
                      {[...history].sort((a, b) => String(a.year).localeCompare(String(b.year))).map((row) => (
                        <div className="grid grid-cols-[45px_minmax(0,1fr)_auto] items-center gap-2 border-t border-border py-1.5 text-[10px] first:border-0" key={String(row.id)}>
                          <strong>{String(row.year || "-")}</strong>
                          <span className="text-muted-foreground">{list(row.months).map((value) => monthNames[Number(value) - 1]).filter(Boolean).join(", ") || "-"}</span>
                          <Pill tone="purple">{String(row.status || "-")}</Pill>
                        </div>
                      ))}
                    </section>
                  );
                })}
              </Card>
            ))}
          </div>
        </>
      ) : null}
      {tab === "manage" ? (
        <div className="grid gap-3">
          <details className="rounded-lg border border-border bg-white">
            <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-bold text-[var(--purple-dark)]"><i className="ti ti-file-import" /> Import vacancy CSV/XLSX</summary>
            <form action={importVacancies} className="flex items-center gap-3 p-3.5">
              <input accept=".csv,.xlsx" className="text-xs" name="file" required type="file" />
              <Button disabled={busy} size="sm" type="submit">Import</Button>
            </form>
          </details>
          {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
          {management}
        </div>
      ) : null}
    </div>
  );
}

function VacancyTable({ rows }: { rows: ApiRecord[] }) {
  return (
    <Card className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>Company / Program</TableHead><TableHead>Industry</TableHead><TableHead>Roles</TableHead><TableHead>Open months</TableHead><TableHead>Deadline</TableHead><TableHead>Career links</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.id)}>
              <TableCell className="whitespace-normal"><strong className="block">{String(row.company || "-")}</strong><span className="text-muted-foreground">{String(row.program || "-")}</span></TableCell>
              <TableCell><Pill tone="blue">{String(row.industry || "-")}</Pill></TableCell>
              <TableCell className="whitespace-normal">{list(row.roles).join(", ") || "-"}</TableCell>
              <TableCell>{list(row.months).map((value) => monthNames[Number(value) - 1]).filter(Boolean).join(", ") || "-"} {String(row.year || "")}</TableCell>
              <TableCell>{String(row.deadline || "Open")}</TableCell>
              <TableCell className="whitespace-normal">{list(row.career_links).map((value, index) => <a className="mr-2 text-[var(--purple-mid)]" href={value} key={value} rel="noreferrer" target="_blank">Link {index + 1}</a>)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function buildNewsletter(rows: ApiRecord[], month: number, selectedWeek: number, industries: string[]) { const monthLabel = monthNames[month]; const industry = industries.length ? ` ${industries.join(", ")}` : ""; const waRows = rows.map((row, index) => `*${index + 1}. ${row.company} - ${row.program}*\nRoles: ${list(row.roles).join(", ") || "-"}\n${list(row.selection).length ? `Selection: ${list(row.selection).join(" -> ")}\n` : ""}${list(row.career_links).map((link) => `Link: ${link}`).join("\n")}`).join("\n\n"); const emailRows = rows.map((row, index) => `${index + 1}. ${String(row.company).toUpperCase()}\n   Program: ${row.program}\n   Role: ${list(row.roles).join(", ") || "-"}\n${list(row.selection).length ? `   Selection: ${list(row.selection).join(" -> ")}\n` : ""}${list(row.career_links).map((link) => `   Link: ${link}`).join("\n")}`).join("\n--------------------------\n"); return { wa: `Halo!\n\nUpdate MT ${monthLabel}, week ${selectedWeek}.\nThere are *${rows.length} new MT vacancies${industry}*.\n\n${waRows}\n\nSee CareerCclub resources at careercclub.com`, email: `Subject: [MT Alert] ${rows.length} New MT Vacancies - ${monthLabel} Week ${selectedWeek}\n\nHello,\n\nHere are this week's MT openings${industry}:\n\n${emailRows}\n\nApplication resources: careercclub.com\n\nCareerCclub Team` }; }
