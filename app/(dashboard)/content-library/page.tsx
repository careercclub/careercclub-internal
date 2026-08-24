import { ContentLibraryWorkspace } from "@/app/_components/content-library-workspace";
import { listContentLibraryItems } from "@/lib/api/content-library";

export default async function ContentLibraryPage() {
  const rows = await listContentLibraryItems();
  return <ContentLibraryWorkspace rows={rows} />;
}
