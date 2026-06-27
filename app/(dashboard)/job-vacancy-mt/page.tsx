import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("job-vacancy-mt");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function JobVacancyMtPage() {
  return <ModulePage page={page} />;
}
