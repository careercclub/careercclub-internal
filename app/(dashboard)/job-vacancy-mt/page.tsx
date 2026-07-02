import { JobVacancyMtTools } from "@/app/_components/job-vacancy-mt-tools";
import { listMtIndustries, listMtVacancies } from "@/lib/api/job-vacancy-mt";

export default async function JobVacancyMtPage() {
  const [rows, industries] = await Promise.all([listMtVacancies(), listMtIndustries()]);
  return <JobVacancyMtTools industries={industries} referenceDate={new Date().toISOString()} rows={rows} />;
}
