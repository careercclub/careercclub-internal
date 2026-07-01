begin;

create function pg_temp.normalize_storage_key(raw_value text, default_area text)
returns text
language sql
immutable
as $$
  select case
    when raw_value is null or btrim(raw_value) = '' then raw_value
    when raw_value ~* '^https?://[^/]+/storage/v1/object/public/(uploads|collaborator-photos|design-assets|task-attachments)/'
      then regexp_replace(raw_value, '^https?://[^/]+/storage/v1/object/public/', '', 'i')
    when raw_value ~* '^https?://' then raw_value
    when ltrim(raw_value, '/') ~ '^(uploads|collaborator-photos|design-assets|task-attachments)/'
      then ltrim(raw_value, '/')
    else default_area || '/' || ltrim(raw_value, '/')
  end;
$$;

update public.content_library
set storage_paths = (
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'string'
          then to_jsonb(pg_temp.normalize_storage_key(item #>> '{}', 'design-assets'))
        else item
      end
      order by item_index
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(storage_paths) with ordinality as entries(item, item_index)
)
where storage_paths is not null
  and jsonb_typeof(storage_paths) = 'array';

update public.design_assets
set storage_path = pg_temp.normalize_storage_key(storage_path, 'design-assets')
where storage_path is not null;

update public.design_assets
set storage_paths = (
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'string'
          then to_jsonb(pg_temp.normalize_storage_key(item #>> '{}', 'design-assets'))
        else item
      end
      order by item_index
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(storage_paths) with ordinality as entries(item, item_index)
)
where storage_paths is not null
  and jsonb_typeof(storage_paths) = 'array';

update public.collaborators
set foto_url = pg_temp.normalize_storage_key(foto_url, 'collaborator-photos')
where foto_url is not null;

commit;
