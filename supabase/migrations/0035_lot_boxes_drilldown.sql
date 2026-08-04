-- 0035 — boxes drill-down for the lot-centric Provisioning page. Scoped by lot and/or a derived
-- flag (aging = unbound, >30 days, never allocated to an order). Admin-only. Never a global
-- "all boxes" dump — always in the context of a lot or a specific flag.
create or replace function fn_admin_lot_boxes(
  p_lot uuid default null,
  p_status text default null,
  p_flag text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table(
  id uuid, human_code text, status text, created_at timestamptz,
  activated_at timestamptz, allocated boolean, total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with base as (
      select b.id, b.human_code, b.status::text as st, b.created_at, b.activated_at,
             exists (select 1 from orders o where o.box_id = b.id) as alloc
        from boxes b
       where (p_lot is null or b.batch_id = p_lot)
    )
    select base.id, base.human_code, base.st, base.created_at, base.activated_at, base.alloc, count(*) over()
      from base
     where (p_status is null or base.st = p_status)
       and (p_flag is null
            or (p_flag = 'aging' and base.st = 'unbound' and base.created_at < now() - interval '30 days' and not base.alloc))
     order by base.created_at desc
     limit p_limit offset p_offset;
end $$;

grant execute on function fn_admin_lot_boxes(uuid,text,text,int,int) to authenticated, service_role;
