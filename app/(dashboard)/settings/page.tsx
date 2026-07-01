import { enhancedNavSections } from "@/app/(dashboard)/_data/navigation-all";
import { RecordManager } from "@/app/_components/record-manager";
import { SettingsWorkspace } from "@/app/_components/settings-workspace";
import { listAppSettings } from "@/lib/api/settings";

export default async function SettingsPage() {
  const settings = await listAppSettings();
  const pages = enhancedNavSections.flatMap((section) => section.pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    section: section.label,
    path: page.path,
    icon: page.icon,
  })));
  return <SettingsWorkspace settings={settings} pages={pages} management={<RecordManager definitionKey="app_settings" rows={settings} />} />;
}
