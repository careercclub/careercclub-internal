import { RecordManager } from "@/app/_components/record-manager";
import { listAppSettings } from "@/lib/api/settings";
import { settingsLinks } from "@/lib/records/links";

export default async function SettingsPage() {
  return <RecordManager definitionKey="app_settings" links={settingsLinks} rows={await listAppSettings()} />;
}
