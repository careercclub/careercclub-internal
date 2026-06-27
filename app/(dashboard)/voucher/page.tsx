import { ModulePage } from "../_components/module-page";
import { getPageBySlug } from "../_data/navigation";

const page = getPageBySlug("voucher");

export const metadata = {
  title: page.title,
  description: page.description,
};

export default function VoucherPage() {
  return <ModulePage page={page} />;
}
