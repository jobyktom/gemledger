-- An item's shop is fixed once created. Moving it would leave its passports,
-- reports, HUIDs and documents owned by the old shop, so the public verify page
-- would show the new shop's details under the old shop's name.
create function private.lock_item_shop()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.shop_id is distinct from old.shop_id then
    raise exception 'an item cannot be moved to another shop';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'an item''s creator cannot be changed';
  end if;
  return new;
end;
$$;
revoke execute on function private.lock_item_shop() from public, anon, authenticated;

create trigger lock_item_shop before update on public.items
  for each row execute function private.lock_item_shop();
