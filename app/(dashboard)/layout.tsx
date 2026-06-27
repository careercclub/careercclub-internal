import { auth } from "@/auth";
import { AppShell } from "./_components/app-shell";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
