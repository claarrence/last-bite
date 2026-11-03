-- Feature 3: Quantity Reservations and Pickup Management
-- Run once in the Supabase dashboard → SQL Editor, after 001_listings.sql.
--
-- Rules enforced here (not only in the UI):
--   * Only discounted, open listings whose pickup window has not ended can be reserved.
--   * Reservations can never exceed the listing's quantity (no overselling).
--   * One active reservation per customer per listing; change its quantity instead.
--   * Customers change or cancel only their own active reservations, before pickup ends.
--   * Only the listing owner marks a reservation collected, using its pickup reference.
--   * Reservation rows are never deleted, so booking history and agreed prices are kept.
--   * A listing with any reservation record cannot be deleted (close it instead).

-- ---------------------------------------------------------------------------
-- reservations table
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  -- "restrict": a listing with reservation records cannot be deleted.
  listing_id    uuid not null references public.listings (id) on delete restrict,
  customer_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quantity      integer not null check (quantity >= 1),
  -- Price per portion agreed at booking time; later listing edits do not change it.
  unit_price    numeric(6, 2) not null check (unit_price > 0),
  pickup_code   text not null unique,
  -- 'expired' is not stored: it is shown when an active reservation's pickup window has ended.
  status        text not null default 'reserved'
                check (status in ('reserved', 'collected', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  collected_at  timestamptz,
  cancelled_at  timestamptz
);

create index if not exists reservations_customer_idx on public.reservations (customer_id);
create index if not exists reservations_listing_idx on public.reservations (listing_id);

-- At most one active reservation per customer per listing.
create unique index if not exists reservations_one_active_per_customer
  on public.reservations (listing_id, customer_id)
  where status = 'reserved';

-- ---------------------------------------------------------------------------
-- Access rules: customers see their own reservations; providers see the
-- reservations for their own listings. There is no direct insert/update/delete
-- access; every change goes through the functions below.
-- ---------------------------------------------------------------------------
alter table public.reservations enable row level security;

grant select on public.reservations to authenticated;

drop policy if exists "Customers and providers view reservations" on public.reservations;
create policy "Customers and providers view reservations"
  on public.reservations for select
  to authenticated
  using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.listings l
      where l.id = reservations.listing_id and l.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Portions already taken per listing (active + collected). Anyone browsing can
-- read these totals, but not who made the reservations.
-- ---------------------------------------------------------------------------
create or replace function public.reserved_quantities(p_listing_ids uuid[])
returns table (listing_id uuid, reserved integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.listing_id, sum(r.quantity)::integer
  from public.reservations r
  where r.listing_id = any (p_listing_ids)
    and r.status in ('reserved', 'collected')
  group by r.listing_id;
$$;

revoke all on function public.reserved_quantities(uuid[]) from public;
grant execute on function public.reserved_quantities(uuid[]) to anon, authenticated;

-- Short reference the customer shows at the counter.
-- 004_pickup_codes.sql replaces this with 6 digits, e.g. 482913.
create or replace function public.new_pickup_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := 'LB-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.reservations where pickup_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.new_pickup_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a reservation
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation(p_listing_id uuid, p_quantity integer)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing     public.listings;
  v_reserved    integer;
  v_remaining   integer;
  v_reservation public.reservations;
begin
  if auth.uid() is null then
    raise exception 'Please log in to reserve food.';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Choose at least 1 portion.';
  end if;

  -- Lock the listing so two people cannot reserve the last portions at the same time.
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'This listing no longer exists.';
  end if;
  if v_listing.listing_type <> 'discounted' then
    raise exception 'Free food is walk-in only and cannot be reserved.';
  end if;
  if v_listing.owner_id = auth.uid() then
    raise exception 'You cannot reserve your own listing.';
  end if;
  if v_listing.status <> 'open' then
    raise exception 'This listing is closed to new bookings.';
  end if;
  if v_listing.pickup_end <= now() then
    raise exception 'The pickup window for this listing has ended.';
  end if;
  if exists (
    select 1 from public.reservations
    where listing_id = p_listing_id and customer_id = auth.uid() and status = 'reserved'
  ) then
    raise exception 'You already have a reservation for this listing. Change its quantity in My Reservations.';
  end if;

  select coalesce(sum(quantity), 0) into v_reserved
  from public.reservations
  where listing_id = p_listing_id and status in ('reserved', 'collected');

  v_remaining := v_listing.quantity_total - v_reserved;
  if v_remaining <= 0 then
    raise exception 'Sorry, this listing is fully reserved.';
  end if;
  if p_quantity > v_remaining then
    raise exception 'Only % portion(s) left. Choose a smaller quantity.', v_remaining;
  end if;

  insert into public.reservations (listing_id, customer_id, quantity, unit_price, pickup_code)
  values (p_listing_id, auth.uid(), p_quantity, v_listing.price, public.new_pickup_code())
  returning * into v_reservation;

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Change the quantity of your own active reservation
-- ---------------------------------------------------------------------------
create or replace function public.update_reservation_quantity(
  p_reservation_id uuid,
  p_quantity integer
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id  uuid;
  v_listing     public.listings;
  v_reservation public.reservations;
  v_others      integer;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Choose at least 1 portion. To give up the booking, cancel it instead.';
  end if;

  select listing_id into v_listing_id
  from public.reservations
  where id = p_reservation_id and customer_id = auth.uid();
  if not found then
    raise exception 'Reservation not found.';
  end if;

  -- Lock the listing first (same order as create_reservation), then the reservation.
  select * into v_listing from public.listings where id = v_listing_id for update;
  select * into v_reservation from public.reservations where id = p_reservation_id for update;

  if v_reservation.status <> 'reserved' then
    raise exception 'Only active reservations can be changed.';
  end if;
  if v_listing.pickup_end <= now() then
    raise exception 'The pickup window has ended, so this reservation can no longer be changed.';
  end if;
  if p_quantity = v_reservation.quantity then
    return v_reservation;
  end if;
  if p_quantity > v_reservation.quantity and v_listing.status <> 'open' then
    raise exception 'This listing is closed to new bookings, so you can only reduce your quantity.';
  end if;

  select coalesce(sum(quantity), 0) into v_others
  from public.reservations
  where listing_id = v_listing.id
    and status in ('reserved', 'collected')
    and id <> v_reservation.id;

  if p_quantity > v_listing.quantity_total - v_others then
    raise exception 'Only % portion(s) available for you.', v_listing.quantity_total - v_others;
  end if;

  update public.reservations
  set quantity = p_quantity, updated_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel your own active reservation (the record is kept; portions return)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_reservation(p_reservation_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations;
  v_pickup_end  timestamptz;
begin
  select * into v_reservation
  from public.reservations
  where id = p_reservation_id and customer_id = auth.uid()
  for update;
  if not found then
    raise exception 'Reservation not found.';
  end if;
  if v_reservation.status <> 'reserved' then
    raise exception 'Only active reservations can be cancelled.';
  end if;

  select pickup_end into v_pickup_end from public.listings where id = v_reservation.listing_id;
  if v_pickup_end <= now() then
    raise exception 'The pickup window has ended, so this reservation has expired.';
  end if;

  update public.reservations
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return v_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provider marks a reservation collected after checking its pickup reference
-- ---------------------------------------------------------------------------
create or replace function public.mark_reservation_collected(
  p_listing_id uuid,
  p_pickup_code text
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations;
begin
  if not exists (
    select 1 from public.listings where id = p_listing_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the provider of this listing can confirm collections.';
  end if;

  select * into v_reservation
  from public.reservations
  where listing_id = p_listing_id
    and pickup_code = upper(trim(p_pickup_code))
  for update;
  if not found then
    raise exception 'No reservation with that pickup reference for this listing.';
  end if;
  if v_reservation.status = 'collected' then
    raise exception 'This reservation has already been collected.';
  end if;
  if v_reservation.status = 'cancelled' then
    raise exception 'This reservation was cancelled by the customer.';
  end if;

  -- Allowed after the pickup window too: the provider is confirming a real handover.
  update public.reservations
  set status = 'collected', collected_at = now(), updated_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return v_reservation;
end;
$$;

revoke all on function public.create_reservation(uuid, integer) from public;
revoke all on function public.update_reservation_quantity(uuid, integer) from public;
revoke all on function public.cancel_reservation(uuid) from public;
revoke all on function public.mark_reservation_collected(uuid, text) from public;
grant execute on function public.create_reservation(uuid, integer) to authenticated;
grant execute on function public.update_reservation_quantity(uuid, integer) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.mark_reservation_collected(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Listing edits: an owner cannot lower the quantity below what is already
-- reserved. Replaces the 001 trigger function (same existing checks kept).
-- security definer so the check counts every customer's reservations.
-- ---------------------------------------------------------------------------
create or replace function public.listings_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved integer;
begin
  if new.listing_type <> old.listing_type then
    raise exception 'listing_type cannot be changed after creation';
  end if;
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  if new.listing_type = 'discounted' and new.quantity_total is distinct from old.quantity_total then
    select coalesce(sum(quantity), 0) into v_reserved
    from public.reservations
    where listing_id = new.id and status in ('reserved', 'collected');
    if new.quantity_total < v_reserved then
      raise exception 'Quantity cannot be lower than the % portion(s) already reserved.', v_reserved;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
