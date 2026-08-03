-- 0022 — delivery address + city (captured at checkout via Google Places — see ADR-0016), and
-- a paginated/filterable admin member list. City drives admin filtering and intake-wave
-- targeting (agent-affiliate-program §1). place_id is the Google Places identifier.

alter table subscriptions
  add column if not exists ship_line1   text,
  add column if not exists ship_city    text,
  add column if not exists ship_postal  text,
  add column if not exists ship_country text,
  add column if not exists ship_place_id text;

-- Paginated, filterable member list. total_count is the filtered total (window), for paging.
create or replace function fn_admin_list_members(
  p_query text default null,
  p_status text default null,   -- active|lapsed|paused|cancelled|prospect|null(all)
  p_city text default null,
  p_limit int default 20,
  p_offset int default 0
) returns table(
  profile_id uuid, email text, display_name text, sub_status text, city text,
  created_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with base as (
      select p.id as pid, u.email::text as em, p.display_name as dn, p.created_at as ca,
             ls.status::text as st, ls.ship_city as ct
        from profiles p
        join auth.users u on u.id = p.id
        left join lateral (
          select s.status, s.ship_city from subscriptions s
           where s.owner_profile_id = p.id order by s.created_at desc limit 1
        ) ls on true
    )
    select pid, em, dn, st, ct, ca, count(*) over()
      from base
     where (p_query is null or em ilike '%' || p_query || '%' or coalesce(dn, '') ilike '%' || p_query || '%')
       and (p_status is null or (p_status = 'prospect' and st is null) or st = p_status)
       and (p_city is null or ct = p_city)
     order by ca desc
     limit p_limit offset p_offset;
end $$;

-- Distinct delivery cities (for the filter dropdown), with member counts.
create or replace function fn_admin_member_cities()
returns table(city text, members int)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select s.ship_city, count(distinct s.owner_profile_id)::int
      from subscriptions s
     where s.ship_city is not null and s.ship_city <> ''
     group by s.ship_city
     order by s.ship_city;
end $$;
