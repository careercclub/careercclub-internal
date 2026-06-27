import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("content-evaluation");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function ContentEvaluationPage() {
  return <ModulePage page={page} />;
}
