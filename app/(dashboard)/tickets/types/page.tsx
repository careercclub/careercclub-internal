import { RETIRED_PAGES, withFocus } from "@/lib/records/links";
import { redirect } from "next/navigation";

// This data is now managed in one place; the old address forwards there (and keeps ?focus from search).
export default async function RetiredPage({ searchParams }: { searchParams: Promise<{ focus?: string | string[] }> }) {
  redirect(withFocus(RETIRED_PAGES["/tickets/types"], (await searchParams).focus));
}
