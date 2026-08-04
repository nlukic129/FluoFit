-- 0043 — Support becomes a ticket INBOX that routes to the member (grill 2026-08). Adds member
-- context + body + accountability (resolved_by/at) + reopen. The raw-ID override toolkit is retired
-- in the UI; those actions live contextually (member detail / Fraud / Box detail).

alter table support_tickets
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references profiles(id);

-- Inbox list with member context + status/query filter + age. Open first, oldest open on top.
create or replace function fn_admin_list_tickets(p_status text default null, p_query text default null)
returns table(
  id uuid, subject text, status text, created_at timestamptz, resolved_at timestamptz,
  age_days int, profile_id uuid, member_email text, member_name text, sub_status text
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select t.id, t.subject, t.status, t.created_at, t.resolved_at,
           extract(day from now() - t.created_at)::int as age_days,
           p.id, u.email::text, p.display_name,
           (select s.status::text from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1)
      from support_tickets t
      join profiles p on p.id = t.profile_id
      join auth.users u on u.id = p.id
     where (p_status is null or t.status = p_status)
       and (p_query is null or t.subject ilike '%'||p_query||'%' or u.email::text ilike '%'||p_query||'%'
            or coalesce(p.display_name,'') ilike '%'||p_query||'%')
     order by (t.status = 'resolved'), t.created_at;
end $$;

-- Ticket detail for the drawer: full body + a member mini-summary.
create or replace function fn_admin_ticket_detail(p_ticket uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'body', t.body, 'status', t.status,
    'created_at', t.created_at, 'resolved_at', t.resolved_at,
    'resolved_by_email', (select u2.email::text from auth.users u2 where u2.id = t.resolved_by),
    'member', jsonb_build_object(
      'profile_id', p.id,
      'email', u.email::text,
      'name', p.display_name,
      'sub_status', (select s.status::text from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1),
      'current_level', coalesce((select current_level from member_progress where profile_id = p.id), 1),
      'last_active', (select last_earning_date from member_progress where profile_id = p.id),
      'benefit_days', (select case when s.benefit_clock_expires_at is null then null
                                   else greatest(0, extract(day from s.benefit_clock_expires_at - now())::int) end
                         from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1)
    )
  ) into v
  from support_tickets t
  join profiles p on p.id = t.profile_id
  join auth.users u on u.id = p.id
  where t.id = p_ticket;
  return v;
end $$;

-- Resolve now records who + when (accountability); reason still audited.
create or replace function fn_resolve_ticket(p_ticket uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  update support_tickets set status = 'resolved', resolved_at = now(), resolved_by = auth.uid() where id = p_ticket;
  perform fn_log_audit('ticket.resolve', 'support_tickets', p_ticket, p_reason, null);
end $$;

create or replace function fn_reopen_ticket(p_ticket uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  update support_tickets set status = 'open', resolved_at = null, resolved_by = null where id = p_ticket;
  perform fn_log_audit('ticket.reopen', 'support_tickets', p_ticket, p_reason, null);
end $$;

-- Operator-friendly unbind/rebind: rebind by email (or leave empty to just unbind).
create or replace function fn_admin_unbind_rebind_email(p_box_id uuid, p_email text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_email is not null and length(trim(p_email)) > 0 then
    select id into v_profile from auth.users where email = lower(trim(p_email));
    if v_profile is null then raise exception 'no account for %', p_email using errcode = 'no_data_found'; end if;
  end if;
  perform fn_admin_unbind_rebind(p_box_id, v_profile, p_reason);
end $$;

grant execute on function
  fn_admin_list_tickets(text,text), fn_admin_ticket_detail(uuid),
  fn_reopen_ticket(uuid,text), fn_admin_unbind_rebind_email(uuid,text,text)
  to authenticated, service_role;
