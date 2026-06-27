import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("content-planning");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function ContentPlanningPage() {
  return <ModulePage page={page} />;
}
