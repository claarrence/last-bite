-- Run after 002_reservations.sql. Establishments provide food; customers reserve it.
-- Existing bookings remain in history and can still be cancelled or collected.
create or replace function public.check_reservation_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.establishment where id = new.customer_id) then
    raise exception 'Establishment accounts cannot reserve food.';
  end if;
  return new;
end;
$$;

revoke all on function public.check_reservation_customer() from public;

drop trigger if exists reservations_customer_only on public.reservations;
create trigger reservations_customer_only
  before insert or update of quantity on public.reservations
  for each row execute function public.check_reservation_customer();
