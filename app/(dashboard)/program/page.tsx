import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("program");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function ProgramPage() {
  return <ModulePage page={page} />;
}
