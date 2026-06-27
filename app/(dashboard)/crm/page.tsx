import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("crm");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function CrmPage() {
  return <ModulePage page={page} />;
}
