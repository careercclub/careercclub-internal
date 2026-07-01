import { MtVacancyTools } from "@/app/_components/mt-vacancy-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listMtVacancies } from "@/lib/api/job-vacancy-mt";
import { mtVacancyLinks } from "@/lib/records/links";

export default async function JobVacancyMtPage() {
  const rows = await listMtVacancies();
  return <RecordManager definitionKey="mt_vacancies" links={mtVacancyLinks} rows={rows} tools={<MtVacancyTools rows={rows} referenceDate={new Date().toISOString()} />} />;
}
