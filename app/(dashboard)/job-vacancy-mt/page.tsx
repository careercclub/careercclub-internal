import { MtProspectsWorkspace } from "@/app/_components/mt-prospects-workspace";
import { latestProspectImport, listProspectContacts, listProspects } from "@/lib/api/mt-prospects";
import { getSheetSync } from "@/lib/api/sheet-sync";

export const metadata = { title: "Job Vacancy MT" };

export default async function JobVacancyMtPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const requested = (await searchParams).tab;
  const tab = Array.isArray(requested) ? requested[0] : requested;
  const [prospects, contacts, lastImport, sheetSync] = await Promise.all([listProspects(), listProspectContacts(), latestProspectImport(), getSheetSync("mt-prospects").catch(() => null)]);
  return <MtProspectsWorkspace contacts={contacts} initialTab={tab} key={tab || "overview"} lastImport={lastImport} prospects={prospects} referenceDate={new Date().toISOString()} sheetSync={sheetSync} />;
}
