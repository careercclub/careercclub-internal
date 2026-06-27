import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("resources");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function ResourcesPage() {
  return <ModulePage page={page} />;
}
