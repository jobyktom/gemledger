-- Create an item with its HUIDs and lab report numbers in one transaction.
-- SECURITY INVOKER: every insert still goes through the caller's RLS policies.
create function public.create_item(
  p_shop_id        uuid,
  p_title          text,
  p_description    text,
  p_metal          public.metal,
  p_karat          smallint,
  p_gross_weight_g numeric,
  p_net_weight_g   numeric,
  p_price_paise    bigint,
  p_huids          text[] default '{}',
  p_reports        jsonb default '[]'  -- [{"lab": "GIA", "report_number": "..."}]
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_item_id uuid;
  v_report  jsonb;
begin
  insert into public.items (shop_id, title, description, metal, karat, gross_weight_g, net_weight_g, price_paise)
  values (p_shop_id, p_title, p_description, p_metal, p_karat, p_gross_weight_g, p_net_weight_g, p_price_paise)
  returning id into v_item_id;

  insert into public.item_huids (item_id, shop_id, huid)
  select v_item_id, p_shop_id, upper(trim(h)) from unnest(coalesce(p_huids, '{}')) as h;

  for v_report in select * from jsonb_array_elements(coalesce(p_reports, '[]'))
  loop
    insert into public.grading_reports (item_id, shop_id, lab, report_number)
    values (v_item_id, p_shop_id, (v_report->>'lab')::public.grading_lab, trim(v_report->>'report_number'));
  end loop;

  return v_item_id;
end;
$$;

revoke execute on function public.create_item(uuid, text, text, public.metal, smallint, numeric, numeric, bigint, text[], jsonb) from public, anon;
grant execute on function public.create_item(uuid, text, text, public.metal, smallint, numeric, numeric, bigint, text[], jsonb) to authenticated;
