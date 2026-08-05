-- 0049 — an Affiliate is manually tuned on TWO knobs (grill 2026-08): their COMMISSION % and the
-- BUYER DISCOUNT % their referred members get. (Agents get both from their tier instead.) Editing
-- commission → future purchases; editing discount → NEW subscribers only (existing subs keep their
-- locked-for-life snapshot in subscriptions.buyer_discount_pct — ADR-0004). fixed_pct = commission.

alter table referrers add column if not exists buyer_discount_pct numeric(5,2)
  check (buyer_discount_pct is null or (buyer_discount_pct >= 0 and buyer_discount_pct <= 100));

-- Backfill existing affiliates with a sensible default so the roster/detail show a value.
update referrers set buyer_discount_pct = 10 where type = 'affiliate' and buyer_discount_pct is null;

-- Add affiliate now sets BOTH rates.
drop function if exists fn_add_affiliate(text, numeric, text);
create function fn_add_affiliate(p_email text, p_fixed_pct numeric, p_buyer_discount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  select id into v_profile from auth.users where email = lower(trim(p_email));
  if v_profile is null then
    raise exception 'no account for %; the person must sign up first', p_email using errcode = 'no_data_found';
  end if;

  update profiles set roles = array_append(roles, 'affiliate')
   where id = v_profile and not ('affiliate' = any(roles));
  insert into referrers(profile_id, type, ref_code, fixed_pct, buyer_discount_pct)
  values (v_profile, 'affiliate', fn_gen_ref_code(), p_fixed_pct, p_buyer_discount)
  on conflict (profile_id) do update set type = 'affiliate', fixed_pct = excluded.fixed_pct,
                                         buyer_discount_pct = excluded.buyer_discount_pct;

  perform fn_log_audit('affiliate.add', 'referrers', v_profile, p_reason,
                       jsonb_build_object('fixed_pct', p_fixed_pct, 'buyer_discount_pct', p_buyer_discount));
  return v_profile;
end $$;

-- Edit an affiliate's rates (either/both; null = leave unchanged). Commission → future purchases;
-- buyer discount → new subscribers only (existing snapshots untouched). Audited.
create or replace function fn_admin_set_affiliate_rates(
  p_profile uuid, p_commission numeric default null, p_buyer_discount numeric default null, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required (audited)' using errcode = 'check_violation'; end if;
  if p_commission is null and p_buyer_discount is null then
    raise exception 'nothing to change' using errcode = 'check_violation'; end if;
  update referrers
     set fixed_pct = coalesce(p_commission, fixed_pct),
         buyer_discount_pct = coalesce(p_buyer_discount, buyer_discount_pct)
   where profile_id = p_profile and type = 'affiliate';
  if not found then raise exception 'affiliate not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('affiliate.set_rates', 'referrers', p_profile, p_reason,
                       jsonb_build_object('commission', p_commission, 'buyer_discount', p_buyer_discount));
end $$;

-- Expose buyer_discount_pct in the roster (drop + recreate for OUT-column change).
drop function if exists fn_admin_list_referrers(referrer_type, int, int);
create function fn_admin_list_referrers(
  p_type referrer_type default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table(profile_id uuid, email text, display_name text, kind text, status text, ref_code text,
              fixed_pct numeric, buyer_discount_pct numeric, current_tier int, active_subs int,
              paid_earnings numeric, pending_earnings numeric, total_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select r.profile_id, u.email::text, p.display_name, r.type::text, r.status::text, r.ref_code,
           r.fixed_pct, r.buyer_discount_pct, r.current_tier,
           (select count(*)::int from attributions a join subscriptions s on s.id = a.subscription_id
             where a.referrer_id = r.profile_id and s.status = 'active'),
           coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'paid'), 0),
           coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state in ('accrued','cleared','payable')), 0),
           count(*) over()
      from referrers r
      join auth.users u on u.id = r.profile_id
      join profiles p on p.id = r.profile_id
     where p_type is null or r.type = p_type
     order by r.created_at desc
     limit p_limit offset p_offset;
end $$;

-- Add buyer_discount_pct to the detail payload.
create or replace function fn_admin_referrer_detail(p_profile uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'profile_id', r.profile_id, 'email', u.email::text, 'name', p.display_name,
    'kind', r.type::text, 'status', r.status::text, 'ref_code', r.ref_code,
    'fixed_pct', r.fixed_pct, 'buyer_discount_pct', r.buyer_discount_pct,
    'current_tier', r.current_tier, 'eligibility_met_at', r.eligibility_met_at,
    'active_subs', (select count(*) from attributions a join subscriptions s on s.id = a.subscription_id
                     where a.referrer_id = r.profile_id and s.status = 'active'),
    'earnings', jsonb_build_object(
      'accrued',     coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'accrued'), 0),
      'cleared',     coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'cleared'), 0),
      'payable',     coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'payable'), 0),
      'paid',        coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'paid'), 0),
      'clawed_back', coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'clawed_back'), 0),
      'total',       coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state <> 'clawed_back'), 0)
    ),
    'referred', coalesce((
      select jsonb_agg(jsonb_build_object(
        'member_id', mp.id, 'member_email', mu.email::text, 'member_name', mp.display_name,
        'sub_status', s.status::text,
        'earned', coalesce((select sum(c.amount) from commissions c
                             where c.subscription_id = a.subscription_id and c.referrer_id = r.profile_id and c.state <> 'clawed_back'), 0)
      ) order by s.created_at desc)
      from attributions a
      join subscriptions s on s.id = a.subscription_id
      join profiles mp on mp.id = s.owner_profile_id
      join auth.users mu on mu.id = mp.id
      where a.referrer_id = r.profile_id), '[]'::jsonb)
  ) into v
  from referrers r
  join auth.users u on u.id = r.profile_id
  join profiles p on p.id = r.profile_id
  where r.profile_id = p_profile;
  return v;
end $$;

grant execute on function
  fn_add_affiliate(text,numeric,numeric,text), fn_admin_set_affiliate_rates(uuid,numeric,numeric,text),
  fn_admin_list_referrers(referrer_type,int,int), fn_admin_referrer_detail(uuid)
  to authenticated, service_role;
