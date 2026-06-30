import { RecordManager } from "@/app/_components/record-manager";
import { listKols } from "@/lib/api/content-planning";
import { contentPlanningLinks } from "@/lib/records/links";

export const metadata = { title: "KOL Directory" };

export default async function KolPage() {
  return <RecordManager definitionKey="kol_list" links={contentPlanningLinks} rows={await listKols()} />;
}
