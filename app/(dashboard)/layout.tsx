import { auth } from "@/auth";
import { AppShell } from "./_components/app-shell";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { listAppSettings } from "@/lib/api/settings";
import { countLateVisibleTickets } from "@/lib/api/tickets";
import { countLateTasks } from "@/lib/api/program";
import { jakartaNow } from "@/lib/dashboard/summary";

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const today = jakartaNow().today;
  const [session, settings, lateTasks] = await Promise.all([auth(), listAppSettings(), countLateTasks(today)]);

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

  // Menu badges show only what is late (red = late), using the Dashboard's rule; tickets
  // are limited to what this person can open on the Tickets page.
  const lateTickets = await countLateVisibleTickets({ role: session.user.role, userId: session.user.id, email: session.user.email }, today);

  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());

  return <AppShell hiddenSlugs={hiddenSlugs} navBadges={{ program: lateTasks, tickets: lateTickets }} monthLabel={monthLabel} user={session.user}>{children}</AppShell>;
}
