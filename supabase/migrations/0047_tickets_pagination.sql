-- 0047 — paginate the support ticket inbox. Adds p_limit/p_offset + total_count. Same columns as
-- 0043 otherwise. OUT-column change → drop + recreate.
drop function if exists fn_admin_list_tickets(text, text);
create function fn_admin_list_tickets(
  p_status text default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table(
  id uuid, subject text, status text, created_at timestamptz, resolved_at timestamptz,
  age_days int, profile_id uuid, member_email text, member_name text, sub_status text,
  total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select t.id, t.subject, t.status, t.created_at, t.resolved_at,
           extract(day from now() - t.created_at)::int as age_days,
           p.id, u.email::text, p.display_name,
           (select s.status::text from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1),
           count(*) over()
      from support_tickets t
      join profiles p on p.id = t.profile_id
      join auth.users u on u.id = p.id
     where (p_status is null or t.status = p_status)
       and (p_query is null or t.subject ilike '%'||p_query||'%' or u.email::text ilike '%'||p_query||'%'
            or coalesce(p.display_name,'') ilike '%'||p_query||'%')
     order by (t.status = 'resolved'), t.created_at
     limit p_limit offset p_offset;
end $$;

grant execute on function fn_admin_list_tickets(text,text,int,int) to authenticated, service_role;
