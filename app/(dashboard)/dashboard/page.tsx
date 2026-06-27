import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("dashboard");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function DashboardPage() {
  return <ModulePage page={page} />;
}
