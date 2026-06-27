import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("settings");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function SettingsPage() {
  return <ModulePage page={page} />;
}
