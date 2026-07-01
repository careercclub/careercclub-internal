import { auth } from "@/auth";
import { AppShell } from "./_components/app-shell";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { listAppSettings } from "@/lib/api/settings";
import { getDashboardCounts } from "@/lib/api/dashboard";

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const [session, settings, counts] = await Promise.all([auth(), listAppSettings(), getDashboardCounts()]);

  if (!session?.user) {
    redirect("/sign-in");
  }

  const menuSetting = settings.find((row) => row.key === "menu_visibility" || row.key === "hidden_modules");
  const settingValue = typeof menuSetting?.value === "string"
    ? (() => { try { return JSON.parse(menuSetting.value); } catch { return []; } })()
    : menuSetting?.value;
  const hiddenSlugs = Array.isArray(settingValue)
    ? settingValue.map(String)
    : settingValue && typeof settingValue === "object" && "hiddenSlugs" in settingValue && Array.isArray(settingValue.hiddenSlugs)
      ? settingValue.hiddenSlugs.map(String)
      : [];

  return <AppShell hiddenSlugs={hiddenSlugs} navBadges={{ program: counts.tasks, tickets: counts.tickets }} user={session.user}>{children}</AppShell>;
}
