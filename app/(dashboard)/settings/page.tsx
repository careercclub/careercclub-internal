import { enhancedNavSections } from "@/app/(dashboard)/_data/navigation-all";
import { SettingsWorkspace } from "@/app/_components/settings-workspace";
import { auth } from "@/auth";
import { listSafeAuthUsers } from "@/lib/api/auth-users";
import { listAgentTokens } from "@/lib/api/agent-tokens";
import { listConnections } from "@/lib/mcp/oauth";
import { listServerErrors } from "@/lib/monitoring/errors";
import { listCarouselCtas } from "@/lib/api/content-planning";
import { listPainPointCategories, listPainPointPlatforms } from "@/lib/api/customer-knowledge";
import { listEventLinkTemplates } from "@/lib/api/program";
import { listMasterProducts, listProductClassifications } from "@/lib/api/products";
import { listAppSettings } from "@/lib/api/settings";
import { listTicketDivisions, listTicketPeople, listTicketTypes } from "@/lib/api/tickets";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; section?: string | string[] }> }) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const session = await auth();
  const isAdmin = session?.user.role?.toLowerCase() === "admin";
  const [settings, masterProduk, divisions, people, types, platforms, categories, linkTemplates, klasifikasi, ctaOptions, users, agentTokens, serverErrors, connections] = await Promise.all([
    listAppSettings(),
    listMasterProducts(),
    listTicketDivisions(),
    listTicketPeople(),
    listTicketTypes(),
    listPainPointPlatforms(),
    listPainPointCategories(),
    listEventLinkTemplates(),
    listProductClassifications(),
    listCarouselCtas(),
    isAdmin ? listSafeAuthUsers() : Promise.resolve([]),
    // null when migration 027 has not run yet: the panel says so instead of failing the page.
    isAdmin ? listAgentTokens().catch(() => null) : Promise.resolve([]),
    isAdmin ? listServerErrors() : Promise.resolve([]),
    // null when migration 034 has not run yet.
    isAdmin ? listConnections().catch(() => null) : Promise.resolve([]),
  ]);
  const pages = enhancedNavSections.flatMap((section) => section.pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    section: section.label,
    path: page.path,
    icon: page.icon,
  })));
  return (
    <SettingsWorkspace
      categories={categories}
      ctaOptions={ctaOptions}
      divisions={divisions}
      isAdmin={isAdmin}
      klasifikasi={klasifikasi}
      linkTemplates={linkTemplates}
      masterProduk={masterProduk}
      pages={pages}
      people={people}
      platforms={platforms}
      settings={settings}
      types={types}
      users={users}
      agentTokens={agentTokens}
      serverErrors={serverErrors}
      connections={connections}
      initialTab={first(query.tab)}
      initialSection={first(query.section)}
      // A sidebar link to another section remounts with that section open.
      key={`${first(query.tab) || ""}:${first(query.section) || ""}`}
    />
  );
}
