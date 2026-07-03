import { enhancedNavSections } from "@/app/(dashboard)/_data/navigation-all";
import { SettingsWorkspace } from "@/app/_components/settings-workspace";
import { auth } from "@/auth";
import { listSafeAuthUsers } from "@/lib/api/auth-users";
import { listCarouselCtas } from "@/lib/api/content-planning";
import { listPainPointCategories, listPainPointPlatforms } from "@/lib/api/customer-knowledge";
import { listEventLinkTemplates } from "@/lib/api/program";
import { listMasterProducts, listProductClassifications } from "@/lib/api/products";
import { listAppSettings } from "@/lib/api/settings";
import { listTicketDivisions, listTicketPeople, listTicketTypes } from "@/lib/api/tickets";

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = session?.user.role?.toLowerCase() === "admin";
  const [settings, masterProduk, divisions, people, types, platforms, categories, linkTemplates, klasifikasi, ctaOptions, users] = await Promise.all([
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
    />
  );
}
