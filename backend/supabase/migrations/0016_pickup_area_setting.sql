-- Step 4t (D-074): the pickup area ("Leicester") is a public setting she edits in Settings, Pickup details. The site pages and the receipt read it.
-- The exact address stays in the private setting pickup_address_text, which is not public.
insert into public.settings (key, value) values ('pickup_area_text', '"Leicester"') on conflict (key) do nothing;
drop policy settings_public_read on public.settings;
create policy settings_public_read on public.settings for select to anon, authenticated
  using (key in ('min_lead_hours', 'max_days_ahead', 'max_qty_per_item', 'custom_min_lead_hours', 'low_stock_threshold',
                 'ordering_open', 'ordering_closed_message', 'included_chutney_tiers', 'customisation_fee_pence', 'customisation_note', 'pickup_area_text'));
