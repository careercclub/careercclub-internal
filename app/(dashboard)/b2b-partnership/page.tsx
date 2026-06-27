import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("b2b-partnership");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function B2bPartnershipPage() {
  return <ModulePage page={page} />;
}
