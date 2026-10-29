-- Putaran 61: a partner (B2B or organization) can have several PICs.
--
-- Until now each partner had one PIC in five columns (contact_name, pos, contact_phone,
-- contact_email, li). The PICs now live in one list, `contacts`, each with name, position,
-- WhatsApp, email and LinkedIn. The five old columns stay and always hold the first PIC
-- (written by the app on every save, lib/partnership/contacts.ts), so global search context,
-- the Claude parser and older exports keep working.

alter table public.partners add column if not exists contacts jsonb not null default '[]'::jsonb;
alter table public.org_partners add column if not exists contacts jsonb not null default '[]'::jsonb;

-- The PIC each partner already has becomes the first entry of its list.
update public.partners
set contacts = jsonb_build_array(jsonb_build_object(
  'name', coalesce(trim(contact_name), ''), 'position', coalesce(trim(pos), ''),
  'phone', coalesce(trim(contact_phone), ''), 'email', coalesce(trim(contact_email), ''), 'linkedin', coalesce(trim(li), '')))
where contacts = '[]'::jsonb
  and concat(trim(contact_name), trim(pos), trim(contact_phone), trim(contact_email), trim(li)) <> '';

update public.org_partners
set contacts = jsonb_build_array(jsonb_build_object(
  'name', coalesce(trim(contact_name), ''), 'position', coalesce(trim(pos), ''),
  'phone', coalesce(trim(contact_phone), ''), 'email', coalesce(trim(contact_email), ''), 'linkedin', coalesce(trim(li), '')))
where contacts = '[]'::jsonb
  and concat(trim(contact_name), trim(pos), trim(contact_phone), trim(contact_email), trim(li)) <> '';
