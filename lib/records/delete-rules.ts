// What happens when a record is deleted (Putaran 56). One list, used by every delete in the app,
// the confirm message ("Also deletes 3 deals") and the tests. Production has no foreign keys for
// most of these (migration 001's keys never ran on the restored Supabase tables), so the app
// enforces them here.
//
// - children: rows that only exist for their parent. They are deleted with it, in the same
//   transaction, and the confirm message says how many.
// - usedBy: other records that point at this one (people on tickets, a division, a platform
//   name). Deleting is refused while any remain, with where they are, so nothing is left
//   pointing at a record that no longer exists.

export type Child = { table: string; column: string; one: string; many: string };
export type UsedBy = { table: string; column: string; match: "id" | "ids" | "name"; one: string; many: string };
export type DeleteRule = { children?: Child[]; usedBy?: UsedBy[]; nameColumn?: string; signInColumn?: string };

const child = (table: string, column: string, one: string, many = `${one}s`): Child => ({ table, column, one, many });
const used = (table: string, column: string, match: UsedBy["match"], one: string, many = `${one}s`): UsedBy => ({ table, column, match, one, many });

export const DELETE_RULES: Record<string, DeleteRule> = {
  // Ticket setup: people, divisions and request types are referenced by id.
  tkt_people: {
    signInColumn: "auth_user_id",
    usedBy: [
      used("tickets", "assigned_to_ids", "ids", "ticket"), used("tickets", "assigned_to_id", "id", "ticket"), used("tickets", "requester_id", "id", "ticket request", "ticket requests"),
      used("tasks", "assignee_ids", "ids", "task"), used("tasks", "assignee_id", "id", "task"),
      used("carousel_plans", "assignee_id", "id", "carousel plan"),
    ],
  },
  tkt_divisi: { usedBy: [used("tickets", "divisi_id", "id", "ticket"), used("tkt_people", "divisi_id", "id", "person", "people"), used("tkt_types", "divisi_id", "id", "request type")] },
  tkt_types: { usedBy: [used("tickets", "type_id", "id", "ticket")] },
  // Customer Knowledge lists: pain points keep the name as text (and Sheet/Claude sync check it).
  pain_point_platforms: { nameColumn: "nama", usedBy: [used("pain_points", "platform", "name", "pain point")] },
  pain_point_categories: { nameColumn: "nama", usedBy: [used("pain_points", "kategori", "name", "pain point")] },
  // Parents and the rows that belong to them.
  buyers: { children: [child("crm_deals", "buyer_id", "deal")] },
  partners: { children: [child("partner_deals", "partner_id", "deal"), child("partner_outreach", "partner_id", "outreach log")] },
  org_partners: { children: [child("org_deals", "org_partner_id", "deal"), child("org_outreach", "org_partner_id", "outreach log")] },
  products: {
    children: [
      child("product_features", "product_id", "feature"), child("product_benefits", "product_id", "benefit"),
      child("product_pain_points", "product_id", "pain point"), child("product_passion_points", "product_id", "passion point"),
      child("sub_products", "product_id", "sub-product"), child("product_bundles", "bundle_id", "bundle item"),
      child("product_assets", "product_id", "asset"), child("product_feedbacks", "product_id", "feedback", "feedback"),
    ],
    usedBy: [used("product_bundles", "item_id", "id", "bundle")],
  },
  product_features: { children: [child("product_feature_links", "feature_id", "shortlink")] },
  sub_products: { children: [child("sub_product_links", "sub_product_id", "shortlink")] },
  competitor_profiles: {
    children: [child("competitor_snapshots", "competitor_id", "snapshot"), child("competitor_flags", "competitor_id", "flag"), child("competitor_products", "competitor_id", "product")],
  },
  competitor_products: { children: [child("competitor_product_prices", "product_id", "price record")] },
  story_plan_dates: { children: [child("story_plan_items", "date_id", "story slide")] },
  carousel_plans: { children: [child("carousel_plan_links", "plan_id", "link")] },
  content_evaluations: { children: [child("ads_contents", "eval_id", "Meta Ads row")] },
  mt_prospects: { children: [child("mt_prospect_contacts", "prospect_id", "HR contact"), child("mt_prospect_research", "prospect_id", "research note")] },
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
function joinWords(parts: string[]) {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** "Also deletes 3 deals and 1 outreach log." or "" — counts per label, children of children included. */
export function alsoDeletesText(counts: Array<{ one: string; many: string; n: number }>) {
  const merged = new Map<string, { one: string; many: string; n: number }>();
  for (const item of counts) {
    if (!item.n) continue;
    const seen = merged.get(item.one);
    merged.set(item.one, seen ? { ...seen, n: seen.n + item.n } : { ...item });
  }
  const parts = [...merged.values()].map((item) => count(item.n, item.one, item.many));
  return parts.length ? `Also deletes ${joinWords(parts)}.` : "";
}

/** "Still used by 4 tickets and 2 tasks. Change them first, then delete it." */
export function stillUsedText(counts: Array<{ one: string; many: string; n: number }>) {
  const merged = new Map<string, { one: string; many: string; n: number }>();
  // One ticket may hold the person in two columns: count the larger, not the sum.
  for (const item of counts) {
    if (!item.n) continue;
    const seen = merged.get(item.one);
    merged.set(item.one, seen ? { ...seen, n: Math.max(seen.n, item.n) } : { ...item });
  }
  const parts = [...merged.values()].map((item) => count(item.n, item.one, item.many));
  return parts.length ? `Still used by ${joinWords(parts)}. Change them first, then delete it.` : "";
}

export const SIGN_IN_TEXT = "This person can sign in. Block the account in Users & roles instead; their tickets stay assigned.";
