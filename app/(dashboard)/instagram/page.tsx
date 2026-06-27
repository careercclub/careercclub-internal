import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("instagram");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function InstagramPage() {
  return <ModulePage page={page} />;
}
