import { MtVacancyTools } from "@/app/_components/mt-vacancy-tools";
import { RecordManager } from "@/app/_components/record-manager";
import { listMtVacancies } from "@/lib/api/job-vacancy-mt";

export default async function JobVacancyMtPage() {
  const rows = await listMtVacancies();
  return <MtVacancyTools rows={rows} referenceDate={new Date().toISOString()} management={<RecordManager definitionKey="mt_vacancies" rows={rows}/>} />;
}
