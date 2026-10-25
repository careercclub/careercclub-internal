import { getSheetSync } from "@/lib/api/sheet-sync";
import { CompetitorTools } from "@/app/_components/competitor-tools";
import { getCompetitorWorkspace } from "@/lib/api/competitor-intel";

export const metadata = { title: "Competitor Intel" };

export default async function CompetitorIntelPage() {
  const [workspace, sheetSync] = await Promise.all([getCompetitorWorkspace(), getSheetSync("competitor-intel").catch(() => null)]);
  return <CompetitorTools sheetSync={sheetSync} workspace={workspace} />;
}
