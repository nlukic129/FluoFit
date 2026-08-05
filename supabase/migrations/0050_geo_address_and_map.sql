-- 0050 — geographic layer (grill 2026-08): precise per-member location = the ground truth
-- (municipality/opština + lat/lng + place_id), business view rolls up to city/zone. Enables the
-- admin subscriber MAP + Places-backed address editing. Real Google (Maps/Places) plugs in via the
-- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY on the client; these columns/RPCs are integration-agnostic.

alter table subscriptions
  add column if not exists ship_municipality text,               -- opština (the fine atom; Beograd → Zemun/Vračar…)
  add column if not exists ship_lat numeric(9,6),
  add column if not exists ship_lng numeric(9,6);

-- Points for the map. p_status: null=all-ever, 'active', 'churned' (lapsed+cancelled), 'paused'.
create or replace function fn_admin_subscriber_map(p_status text default null)
returns table(
  profile_id uuid, display_name text, email text, sub_status text,
  city text, municipality text, lat numeric, lng numeric
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select p.id, p.display_name, u.email::text, s.status::text, s.ship_city, s.ship_municipality, s.ship_lat, s.ship_lng
      from subscriptions s
      join profiles p on p.id = s.owner_profile_id
      join auth.users u on u.id = p.id
     where s.ship_lat is not null and s.ship_lng is not null
       and (p_status is null
            or (p_status = 'churned' and s.status in ('lapsed','cancelled'))
            or s.status::text = p_status);
end $$;

-- Update a member's delivery address (from the Places-backed editor). Latest subscription. Audited.
create or replace function fn_admin_set_member_address(
  p_profile uuid, p_line1 text, p_city text, p_municipality text, p_postal text,
  p_country text, p_place_id text, p_lat numeric, p_lng numeric, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare v_sub uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required (audited)' using errcode = 'check_violation'; end if;
  select id into v_sub from subscriptions where owner_profile_id = p_profile order by created_at desc limit 1;
  if v_sub is null then raise exception 'no subscription for this member' using errcode = 'no_data_found'; end if;

  update subscriptions
     set ship_line1 = p_line1, ship_city = p_city, ship_municipality = p_municipality,
         ship_postal = p_postal, ship_country = coalesce(p_country, 'RS'),
         ship_place_id = p_place_id, ship_lat = p_lat, ship_lng = p_lng, updated_at = now()
   where id = v_sub;
  perform fn_log_audit('member.set_address', 'subscriptions', v_sub, p_reason,
                       jsonb_build_object('city', p_city, 'municipality', p_municipality, 'place_id', p_place_id));
end $$;

grant execute on function fn_admin_subscriber_map(text),
  fn_admin_set_member_address(uuid,text,text,text,text,text,text,numeric,numeric,text)
  to authenticated, service_role;
