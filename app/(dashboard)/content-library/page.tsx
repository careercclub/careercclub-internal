import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("content-library");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function ContentLibraryPage() {
  return <ModulePage page={page} />;
}
