-- 0046 — paginate the referrer roster (agents/affiliates can grow). Adds p_limit/p_offset +
-- total_count (window). Same columns as 0045 otherwise. OUT-column change → drop + recreate.
drop function if exists fn_admin_list_referrers(referrer_type);
create function fn_admin_list_referrers(
  p_type referrer_type default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table(profile_id uuid, email text, display_name text, kind text, status text, ref_code text,
              fixed_pct numeric, current_tier int, active_subs int,
              paid_earnings numeric, pending_earnings numeric, total_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select r.profile_id, u.email::text, p.display_name, r.type::text, r.status::text, r.ref_code, r.fixed_pct, r.current_tier,
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

grant execute on function fn_admin_list_referrers(referrer_type,int,int) to authenticated, service_role;
