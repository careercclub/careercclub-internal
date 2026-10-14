import { REMOVED_PAGES } from "@/lib/records/links";
import { redirect } from "next/navigation";

// The Voucher module was removed; old bookmarks land on the dashboard. Voucher data stays in the database.
export default function RetiredVoucherPage() {
  redirect(REMOVED_PAGES["/voucher"]);
}
