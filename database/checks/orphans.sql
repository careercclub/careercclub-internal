-- Records pointing at something that was deleted before Putaran 56 (read-only: counts only, no
-- personal data, nothing is changed).
--
-- Until Putaran 56 most deletes did not check who still used the record, and production has no
-- foreign keys for these tables (migration 001's keys never ran on the restored Supabase tables).
-- Since Putaran 56 every delete is checked (lib/records/delete-rules.ts), so these numbers can
-- only go down. Screens show "Removed person" for a deleted assignee; the rest show "Unknown".
--
-- Run on the VPS in psql:
--   docker compose -f docker-compose.production.yml exec postgres psql -U ccc_user -d ccc -f /dev/stdin < database/checks/orphans.sql
-- Send the result to the team before deleting anything: cleaning up is a separate, deliberate step.

select 'tickets → removed assignee' as reference, count(*) as rows from tickets t
  where exists (select 1 from unnest(coalesce(t.assigned_to_ids, '{}'::uuid[])) a(id) where not exists (select 1 from tkt_people p where p.id = a.id))
     or (t.assigned_to_id is not null and not exists (select 1 from tkt_people p where p.id = t.assigned_to_id))
union all select 'tickets → removed requester', count(*) from tickets t where t.requester_id is not null and not exists (select 1 from tkt_people p where p.id = t.requester_id)
union all select 'tickets → removed division', count(*) from tickets t where t.divisi_id is not null and not exists (select 1 from tkt_divisi d where d.id = t.divisi_id)
union all select 'tickets → removed request type', count(*) from tickets t where t.type_id is not null and not exists (select 1 from tkt_types y where y.id = t.type_id)
union all select 'tasks → removed assignee', count(*) from tasks t
  where exists (select 1 from unnest(coalesce(t.assignee_ids, '{}'::uuid[])) a(id) where not exists (select 1 from tkt_people p where p.id = a.id))
union all select 'tasks → removed event', count(*) from tasks t where t.project_id is not null and not exists (select 1 from events e where e.id = t.project_id)
union all select 'carousel plans → removed assignee', count(*) from carousel_plans c where c.assignee_id is not null and not exists (select 1 from tkt_people p where p.id = c.assignee_id)
union all select 'people → removed division', count(*) from tkt_people p where p.divisi_id is not null and not exists (select 1 from tkt_divisi d where d.id = p.divisi_id)
union all select 'request types → removed division', count(*) from tkt_types y where y.divisi_id is not null and not exists (select 1 from tkt_divisi d where d.id = y.divisi_id)
union all select 'CRM deals → removed buyer', count(*) from crm_deals x where x.buyer_id is not null and not exists (select 1 from buyers b where b.id = x.buyer_id)
union all select 'B2B deals → removed partner', count(*) from partner_deals x where x.partner_id is not null and not exists (select 1 from partners b where b.id = x.partner_id)
union all select 'B2B outreach → removed partner', count(*) from partner_outreach x where x.partner_id is not null and not exists (select 1 from partners b where b.id = x.partner_id)
union all select 'Org deals → removed organization', count(*) from org_deals x where x.org_partner_id is not null and not exists (select 1 from org_partners b where b.id = x.org_partner_id)
union all select 'Org outreach → removed organization', count(*) from org_outreach x where x.org_partner_id is not null and not exists (select 1 from org_partners b where b.id = x.org_partner_id)
union all select 'product features → removed product', count(*) from product_features x where not exists (select 1 from products b where b.id = x.product_id)
union all select 'product benefits → removed product', count(*) from product_benefits x where not exists (select 1 from products b where b.id = x.product_id)
union all select 'product pain points → removed product', count(*) from product_pain_points x where not exists (select 1 from products b where b.id = x.product_id)
union all select 'product passion points → removed product', count(*) from product_passion_points x where not exists (select 1 from products b where b.id = x.product_id)
union all select 'sub-products → removed product', count(*) from sub_products x where not exists (select 1 from products b where b.id = x.product_id)
union all select 'bundle items → removed product', count(*) from product_bundles x where not exists (select 1 from products b where b.id = x.bundle_id) or not exists (select 1 from products b where b.id = x.item_id)
union all select 'feature shortlinks → removed feature', count(*) from product_feature_links x where not exists (select 1 from product_features b where b.id = x.feature_id)
union all select 'sub-product shortlinks → removed sub-product', count(*) from sub_product_links x where not exists (select 1 from sub_products b where b.id = x.sub_product_id)
union all select 'competitor snapshots → removed competitor', count(*) from competitor_snapshots x where not exists (select 1 from competitor_profiles b where b.id = x.competitor_id)
union all select 'competitor products → removed competitor', count(*) from competitor_products x where not exists (select 1 from competitor_profiles b where b.id = x.competitor_id)
union all select 'competitor prices → removed product', count(*) from competitor_product_prices x where not exists (select 1 from competitor_products b where b.id = x.product_id)
union all select 'event rundown → removed event', count(*) from event_rundown x where not exists (select 1 from events b where b.id = x.event_id)
union all select 'story slides → removed date', count(*) from story_plan_items x where not exists (select 1 from story_plan_dates b where b.id = x.date_id)
union all select 'pain points → platform not in list', count(*) from pain_points x where not exists (select 1 from pain_point_platforms b where lower(trim(b.nama)) = lower(trim(x.platform)))
union all select 'pain points → category not in list', count(*) from pain_points x where not exists (select 1 from pain_point_categories b where lower(trim(b.nama)) = lower(trim(x.kategori)))
order by 1;
