import { ContentPlanningTools } from "@/app/_components/content-planning-tools";
import { listCarouselCtas, listCarouselPlanLinks, listCarouselPlans, listKols, listMtStories, listStoryPlanDates, listStoryPlanItems, listStoryPlanLinks } from "@/lib/api/content-planning";
import { listTicketDivisions, listTicketPeople } from "@/lib/api/tickets";

export const metadata = { title: "Content Planning" };

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }

export default async function ContentPlanningPage() {
  const [dates, stories, storyLinks, carousels, carouselLinks, ctas, kols, mtStories, people, divisions] = await Promise.all([
    listStoryPlanDates(),
    listStoryPlanItems(),
    listStoryPlanLinks(),
    listCarouselPlans(),
    listCarouselPlanLinks(),
    listCarouselCtas(),
    listKols(),
    listMtStories(),
    listTicketPeople(),
    listTicketDivisions(),
  ]);

  // Assignee dropdown mirrors the legacy: marketing-division people, falling back to all.
  const marketingDivisionIds = divisions.filter((division) => text(division.nama).toLowerCase().includes("market")).map((division) => String(division.id));
  const marketingPeople = marketingDivisionIds.length ? people.filter((person) => marketingDivisionIds.includes(text(person.divisi_id))) : [];
  const assignees = marketingPeople.length ? marketingPeople : people;

  return (
    <ContentPlanningTools
      dates={dates}
      stories={stories}
      storyLinks={storyLinks}
      carousels={carousels}
      carouselLinks={carouselLinks}
      ctas={ctas}
      kols={kols}
      mtStories={mtStories}
      people={assignees}
    />
  );
}
