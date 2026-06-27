import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("products");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function ProductsPage() {
  return <ModulePage page={page} />;
}
