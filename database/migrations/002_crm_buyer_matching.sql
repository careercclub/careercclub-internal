begin;

create or replace function ccc_normalize_wa(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  trimmed_value text := btrim(coalesce(raw_value, ''));
  digits text := regexp_replace(btrim(coalesce(raw_value, '')), '\D', '', 'g');
begin
  if digits = '' then
    return '';
  end if;

  if left(trimmed_value, 1) = '+' and left(trimmed_value, 3) <> '+62' then
    return digits;
  end if;

  if left(digits, 1) = '0' then
    return '62' || substring(digits from 2);
  end if;

  if left(digits, 2) <> '62' then
    return '62' || digits;
  end if;

  return digits;
end;
$$;

create or replace function count_unique_buyers()
returns bigint
language sql
stable
as $$
  select count(distinct coalesce(
    nullif(ccc_normalize_wa(wa), ''),
    nullif(lower(btrim(email)), ''),
    id::text
  ))
  from buyers
  where upper(coalesce(payment_status, '')) = 'SUCCESS';
$$;

create index if not exists buyers_normalized_wa_idx on buyers (ccc_normalize_wa(wa));
create index if not exists buyers_email_lower_idx on buyers (lower(btrim(email)));
create index if not exists talent_pool_normalized_wa_idx on talent_pool (ccc_normalize_wa(wa));
create index if not exists talent_pool_email_match_idx on talent_pool (lower(btrim(email)));

commit;
