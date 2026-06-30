begin;

-- R2 stores the former Supabase buckets as top-level key prefixes in ccc-ops.
-- Keep external URLs untouched and normalize only URLs from this Supabase project.
update competitor_products
set image_url = regexp_replace(
  image_url,
  '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/',
  '',
  'i'
)
where image_url ~* '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/';

update competitor_products
set image_urls = (
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'string'
          and (item #>> '{}') ~* '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/'
        then to_jsonb(regexp_replace(
          item #>> '{}',
          '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/',
          '',
          'i'
        ))
        else item
      end
      order by item_index
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(image_urls) with ordinality as entries(item, item_index)
)
where jsonb_typeof(image_urls) = 'array'
  and image_urls::text ~* 'https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/';

update competitor_profiles
set logo_url = regexp_replace(
  logo_url,
  '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/',
  '',
  'i'
)
where logo_url ~* '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/';

update mt_story_list
set foto_url = regexp_replace(
  foto_url,
  '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/',
  '',
  'i'
)
where foto_url ~* '^https://yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/';

do $$
declare
  remaining_references bigint;
begin
  select
    (select count(*) from competitor_products where image_url::text ~* 'yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/')
    + (select count(*) from competitor_products where image_urls::text ~* 'yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/')
    + (select count(*) from competitor_profiles where logo_url::text ~* 'yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/')
    + (select count(*) from mt_story_list where foto_url::text ~* 'yqiijyylqocvohptkvau\.supabase\.co/storage/v1/object/public/')
  into remaining_references;

  if remaining_references <> 0 then
    raise exception 'Storage migration left % Supabase references', remaining_references;
  end if;
end;
$$;

commit;
