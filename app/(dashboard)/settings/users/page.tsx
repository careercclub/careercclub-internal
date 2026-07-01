import { UserManagement } from "@/app/_components/user-management";
import { auth } from "@/auth";
import { listSafeAuthUsers } from "@/lib/api/auth-users";
import { redirect } from "next/navigation";

export default async function SettingsUsersPage() {
  const session = await auth();
  if (session?.user.role?.toLowerCase() !== "admin") redirect("/settings");
  return <UserManagement users={await listSafeAuthUsers()} />;
}
