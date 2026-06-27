import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("org-partnership");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function OrgPartnershipPage() {
  return <ModulePage page={page} />;
}
