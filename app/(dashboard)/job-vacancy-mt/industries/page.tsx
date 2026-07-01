import { RecordManager } from "@/app/_components/record-manager";
import { listMtIndustries } from "@/lib/api/job-vacancy-mt";
import { mtVacancyLinks } from "@/lib/records/links";

export default async function MtIndustriesPage() {
  return <RecordManager definitionKey="mt_industries" links={mtVacancyLinks} rows={await listMtIndustries()} />;
}
