-- Step 4r (D-072): free chutney with every order, no hot sauce.
-- 1. The hot sauce product is hidden, not deleted (old orders keep its name in their own snapshot); its stock row is removed.
-- 2. The editable list of free-pot sizes is a public setting (the shop shows its label), empty by default.
-- 3. The order function adds one free "Free chutney pot" line (price 0, is_included) to every order that has a pack. It changes no total,
--    stock, option rule or limit, and cancelling or re-opening ignores it (it matches no product).
update public.products set active = false, available = false where slug = 'hot-sauce-pot';
delete from public.product_stock where product_id = (select id from public.products where slug = 'hot-sauce-pot');

drop policy settings_public_read on public.settings;
create policy settings_public_read on public.settings for select to anon, authenticated
  using (key in ('min_lead_hours', 'max_days_ahead', 'max_qty_per_item', 'custom_min_lead_hours', 'low_stock_threshold',
                 'ordering_open', 'ordering_closed_message', 'included_chutney_tiers'));

create or replace function public._place_order(p jsonb, p_manual boolean, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_open boolean := coalesce((public._setting('ordering_open') #>> '{}')::boolean, true);
  v_closed_msg text := coalesce(public._setting('ordering_closed_message') #>> '{}', 'We are not taking orders right now. Please check back soon.');
  v_max_qty integer := public._setting_int('max_qty_per_item', 10);
  v_min_lead integer := public._setting_int('min_lead_hours', 1);
  v_custom_lead integer := public._setting_int('custom_min_lead_hours', 48);
  v_day_limit integer := public._setting_int('max_orders_per_day', null);
  v_prefix text := coalesce(public._setting('order_prefix') #>> '{}', 'SS');
  v_name text := left(btrim(coalesce(p ->> 'name', '')), 80);
  v_phone text := left(btrim(coalesce(p ->> 'phone', '')), 20);
  v_notes text := left(btrim(coalesce(p ->> 'notes', '')), 500);
  v_digits text;
  v_pickup_date date;
  v_pickup_time time;
  v_item jsonb; v_prod public.products%rowtype; v_qty numeric; v_oid text; v_opt record;
  v_lines jsonb := '[]'::jsonb; v_opts jsonb; v_seen uuid[]; v_unit integer; v_custom boolean; v_any_custom boolean := false;
  v_packs integer; v_tiers jsonb; v_tier_label text; v_need record; v_stock integer; v_pre boolean; v_ready_max date; v_ready date; v_taken integer; v_room integer; v_pre_name text;
  v_check text; v_lead integer; v_today date := public.uk_today(p_now);
  v_number integer; v_order_number text; v_total integer; v_items jsonb; v_id uuid;
begin
  if not p_manual and not v_open then return public._err('paused', v_closed_msg); end if;
  if jsonb_typeof(p -> 'items') is distinct from 'array' or jsonb_array_length(p -> 'items') = 0 then
    return public._err('empty', 'Your cart is empty.');
  end if;
  if jsonb_array_length(p -> 'items') > 20 then return public._err('too_many', 'At most 20 different items per order.'); end if;
  if not p_manual then
    if v_name = '' then return public._err('name', 'Enter your name.'); end if;
    -- UK number: strip punctuation, 0 or +44 or 0044 prefix, then 44 followed by 9 or 10 digits (same rule as the browser)
    v_digits := regexp_replace(regexp_replace(v_phone, '\(0\)', '', 'g'), '[^0-9+]', '', 'g');
    v_digits := regexp_replace(v_digits, '^\+', '');
    if v_digits like '0044%' then v_digits := substr(v_digits, 3);
    elsif v_digits like '0%' then v_digits := '44' || substr(v_digits, 2); end if;
    if v_digits !~ '^44[0-9]{9,10}$' then return public._err('phone', 'Enter a UK phone number, for example 07123 456789.'); end if;
  end if;

  -- pickup values: a bad shape is a refusal, not an exception
  begin
    v_pickup_date := nullif(p ->> 'pickupDate', '')::date;
    v_pickup_time := nullif(p ->> 'pickupTime', '')::time;
  exception when others then
    return public._err('pickup', 'That pickup day is not available. Please choose another.');
  end;

  -- lines: recompute everything from the tables
  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    select * into v_prod from public.products where slug = (v_item ->> 'slug') and active;
    if not found or not v_prod.available or v_prod.price_pence is null then
      return public._err('product', 'One of the items is no longer available.');
    end if;
    begin v_qty := floor((v_item ->> 'qty')::numeric); exception when others then v_qty := 0; end;
    if not (v_qty >= 1 and v_qty <= v_max_qty) then
      return public._err('quantity', format('Choose between 1 and %s of each item.', v_max_qty));
    end if;
    -- pre-order (D-071): only when stock is 0 now, pre-order is on for the product and its ready date has not passed
    v_pre := v_prod.preorder_enabled and v_prod.preorder_ready_date is not null and v_prod.preorder_ready_date >= v_today
             and exists (select 1 from public.product_stock s where s.product_id = v_prod.id and s.quantity = 0);
    if v_pre then
      v_ready := v_prod.preorder_ready_date; v_ready_max := greatest(coalesce(v_ready_max, v_ready), v_ready);
    end if;
    v_unit := v_prod.price_pence; v_opts := '[]'::jsonb; v_seen := '{}'; v_custom := false;
    if jsonb_typeof(v_item -> 'options') = 'array' then
      for v_oid in select distinct x from jsonb_array_elements_text(v_item -> 'options') x loop
        begin
          -- an option must belong to a group that applies to this product: linked to it directly, or to its category
          select o.id, o.label, o.price_delta_pence, o.is_default, g.id as gid, g.name as glabel, g.kind into strict v_opt
          from public.options o join public.option_groups g on g.id = o.group_id
          where o.id = coalesce((select a.new_id from public.option_id_aliases a where a.old_id = v_oid::uuid), v_oid::uuid)
            and o.active and g.active
            and (exists (select 1 from public.product_option_groups_link l where l.group_id = g.id and l.product_id = v_prod.id)
                 or exists (select 1 from public.category_option_groups c where c.group_id = g.id and c.category_id = v_prod.category_id));
        exception when others then
          return public._err('option', 'One of the options is not valid for that item.');
        end;
        if v_opt.kind = 'single' and v_opt.gid = any (v_seen) then
          return public._err('option', format('Choose only one %s.', lower(v_opt.glabel)));
        end if;
        v_seen := v_seen || v_opt.gid;
        v_unit := v_unit + v_opt.price_delta_pence;
        v_opts := v_opts || jsonb_build_array(jsonb_build_object('group', v_opt.glabel, 'label', v_opt.label, 'price_delta_pence', v_opt.price_delta_pence));
        if not v_opt.is_default then v_custom := true; end if;
      end loop;
    end if;
    v_any_custom := v_any_custom or v_custom;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('pid', v_prod.id, 'slug', v_prod.slug, 'name', v_prod.name,
      'unit_label', v_prod.unit_label, 'qty', v_qty::integer, 'unit_price_pence', v_unit, 'options', v_opts, 'customised', v_custom,
      'kind', v_prod.kind, 'is_preorder', coalesce(v_pre, false), 'is_included', false, 'ready_from', case when v_pre then to_jsonb(v_ready) else null end));
  end loop;

  -- Standard lines are frozen stock: lock the stock rows (in a fixed order) and check them. Customised lines are made to order.
  for v_need in
    select (l ->> 'pid')::uuid as pid, sum((l ->> 'qty')::integer) as qty
    from jsonb_array_elements(v_lines) l where not (l ->> 'customised')::boolean and not (l ->> 'is_preorder')::boolean and not (l ->> 'is_included')::boolean group by 1 order by 1
  loop
    select quantity into v_stock from public.product_stock where product_id = v_need.pid for update;
    if found and v_need.qty > v_stock then
      select * into v_prod from public.products where id = v_need.pid;
      return public._err('stock', case when v_stock = 0 then format('%s is sold out.', v_prod.name) else format('Only %s of %s left.', v_stock, v_prod.name) end);
    end if;
  end loop;

  -- pre-order rules: the limit for the batch has room, and the pickup day is on or after the latest ready date
  for v_need in
    select (l ->> 'slug') as slug, (l ->> 'ready_from')::date as ready, sum((l ->> 'qty')::integer)::integer as qty
    from jsonb_array_elements(v_lines) l where (l ->> 'is_preorder')::boolean group by 1, 2 order by 1
  loop
    select * into v_prod from public.products where slug = v_need.slug;
    if v_prod.preorder_limit is not null then
      perform pg_advisory_xact_lock(hashtext('preorder:' || v_need.slug));
      select coalesce(sum((l ->> 'qty')::integer), 0) into v_taken
      from public.orders o, jsonb_array_elements(o.items) l
      where o.status not in ('cancelled', 'collected') and (l ->> 'slug') = v_need.slug and coalesce((l ->> 'is_preorder')::boolean, false)
        and (l ->> 'ready_from')::date = v_need.ready;
      v_room := greatest(0, v_prod.preorder_limit - v_taken);
      if v_need.qty > v_room then
        return public._err('preorder_full', case when v_room = 0 then format('Pre-orders for %s are full.', v_prod.name) else format('Only %s more pre-orders for %s.', v_room, v_prod.name) end);
      end if;
    end if;
  end loop;
  if v_ready_max is not null and (v_pickup_date is null or v_pickup_date < v_ready_max) then
    return public._err('pickup', format('Pre-order items are ready from %s. Please choose that day or later.', to_char(v_ready_max, 'FMDay DD FMMonth')));
  end if;

  if v_pickup_date is not null and not p_manual then
    v_lead := case when v_any_custom then greatest(v_min_lead, v_custom_lead) else v_min_lead end;
    v_check := public._pickup_check(v_pickup_date, v_pickup_time, v_lead, p_now);
    if v_check = 'day' then
      return public._err('pickup', case when v_any_custom then format('Customised orders need %s'' notice. Please choose a later day.', case when v_lead % 24 = 0 then (v_lead / 24) || (case when v_lead = 24 then ' day' else ' days' end) else v_lead || ' hours' end)
                                     else 'That pickup day is not available. Please choose another.' end);
    elsif v_check = 'time' then
      return public._err('pickup', 'That pickup time is not available. Please choose another.');
    end if;
    -- one order at a time per pickup date, so two buyers cannot both take the last place of the day
    perform pg_advisory_xact_lock(hashtext('pickup:' || v_pickup_date::text));
    if v_day_limit is not null and (select count(*) from public.orders where pickup_date = v_pickup_date and status <> 'cancelled') >= v_day_limit then
      return public._err('day_full', 'That day is full. Please choose another day.');
    end if;
  end if;

  -- the free chutney pot (D-072): one with every order that has at least one pack; its size label comes from her editable list
  select coalesce(sum((l ->> 'qty')::integer), 0) into v_packs from jsonb_array_elements(v_lines) l where l ->> 'kind' = 'pack';
  if v_packs > 0 then
    v_tiers := coalesce(public._setting('included_chutney_tiers'), '[]'::jsonb);
    if jsonb_typeof(v_tiers) = 'array' then
      select t ->> 'label' into v_tier_label from jsonb_array_elements(v_tiers) t
      where (t ->> 'min_packs')::integer <= v_packs order by (t ->> 'min_packs')::integer desc limit 1;
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('slug', 'free-chutney-pot', 'name', 'Free chutney pot', 'unit_label', nullif(v_tier_label, ''),
      'qty', 1, 'unit_price_pence', 0, 'options', '[]'::jsonb, 'customised', false, 'kind', 'addon', 'is_preorder', false, 'is_included', true, 'ready_from', null));
  end if;

  -- write: next number (row lock on the counter), lower stock, insert, all in this one transaction
  insert into public.order_counters (order_date, last_number) values (v_today, 1)
    on conflict (order_date) do update set last_number = public.order_counters.last_number + 1 returning last_number into v_number;
  v_order_number := format('%s-%s%s-%s', v_prefix, to_char(v_today, 'DD'), to_char(v_today, 'MM'), lpad(v_number::text, 2, '0'));
  select jsonb_agg(l - 'pid') into v_items from jsonb_array_elements(v_lines) l;
  select sum((l ->> 'unit_price_pence')::integer * (l ->> 'qty')::integer) into v_total from jsonb_array_elements(v_lines) l;
  update public.product_stock s set quantity = s.quantity - n.qty
    from (select (l ->> 'pid')::uuid as pid, sum((l ->> 'qty')::integer)::integer as qty from jsonb_array_elements(v_lines) l
          where not (l ->> 'customised')::boolean and not (l ->> 'is_preorder')::boolean and not (l ->> 'is_included')::boolean group by 1) n where s.product_id = n.pid;
  insert into public.orders (order_number, order_date, pickup_date, pickup_time, customer_name, customer_phone, notes, items, total_pence,
                             status, source, stock_taken)
    values (v_order_number, v_today, v_pickup_date, case when v_pickup_date is null then null else v_pickup_time end,
            nullif(v_name, ''), nullif(v_phone, ''), nullif(v_notes, ''), v_items, v_total, 'new',
            case when p_manual then 'manual' else 'website' end, true)
    returning id into v_id;
  return jsonb_build_object('ok', true, 'order_id', v_id, 'order_number', v_order_number, 'total_pence', v_total);
end $$;
revoke all on function public._place_order(jsonb, boolean, timestamptz) from public;
