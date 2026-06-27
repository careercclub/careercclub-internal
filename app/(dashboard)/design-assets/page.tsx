import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("design-assets");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function DesignAssetsPage() {
  return <ModulePage page={page} />;
}
