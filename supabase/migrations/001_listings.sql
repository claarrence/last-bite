-- Feature 1: Post and Manage Surplus Food Listings
-- Run once in the Supabase dashboard → SQL Editor.

-- ---------------------------------------------------------------------------
-- listings table
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_type            text not null check (listing_type in ('free', 'discounted')),
  title                   text not null check (char_length(title) between 1 and 80),
  description             text check (char_length(description) <= 500),
  photo_path              text not null,

  -- discounted: exact quantity + price; free: approximate level
  price                   numeric(6, 2),
  quantity_total          integer,
  quantity_level          text check (quantity_level in ('plenty', 'some', 'few', 'unknown')),

  address                 text not null,
  collection_instructions text,
  lat                     numeric,  -- filled later by the OneMap address picker
  lng                     numeric,

  pickup_start            timestamptz not null,
  pickup_end              timestamptz not null,

  dietary_tags            text[] not null default '{}',
  allergens               text[] not null default '{}',

  status                  text not null default 'open' check (status in ('open', 'closed')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint pickup_window_valid check (pickup_end > pickup_start),
  constraint discounted_fields check (
    listing_type <> 'discounted'
    or (price > 0 and quantity_total >= 1 and quantity_level is null)
  ),
  constraint free_fields check (
    listing_type <> 'free'
    or (quantity_level is not null and price is null and quantity_total is null)
  ),
  constraint unknown_allergen_exclusive check (
    not ('Unknown' = any (allergens)) or cardinality(allergens) = 1
  )
);

create index if not exists listings_owner_idx on public.listings (owner_id);
create index if not exists listings_pickup_end_idx on public.listings (pickup_end);

-- ---------------------------------------------------------------------------
-- keep updated_at fresh and stop listing_type / owner from changing
-- ---------------------------------------------------------------------------
create or replace function public.listings_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.listing_type <> old.listing_type then
    raise exception 'listing_type cannot be changed after creation';
  end if;
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists listings_before_update on public.listings;
create trigger listings_before_update
  before update on public.listings
  for each row execute function public.listings_before_update();

-- ---------------------------------------------------------------------------
-- is the logged-in user an establishment? (security definer so it works
-- regardless of the establishment table's own access rules)
-- ---------------------------------------------------------------------------
create or replace function public.is_establishment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.establishment where id = auth.uid());
$$;

revoke all on function public.is_establishment() from public;
grant execute on function public.is_establishment() to authenticated;

-- ---------------------------------------------------------------------------
-- access rules (RLS)
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;

grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

drop policy if exists "Anyone can view listings" on public.listings;
create policy "Anyone can view listings"
  on public.listings for select
  to anon, authenticated
  using (true);

-- Free listings: any logged-in user. Discounted: establishments only.
drop policy if exists "Users create own listings" on public.listings;
create policy "Users create own listings"
  on public.listings for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and (
      listing_type = 'free'
      or public.is_establishment()
    )
  );

drop policy if exists "Owners update own listings" on public.listings;
create policy "Owners update own listings"
  on public.listings for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners delete own listings" on public.listings;
create policy "Owners delete own listings"
  on public.listings for delete
  to authenticated
  using (owner_id = auth.uid());
-- Listings with reservations cannot be deleted: see the foreign key in 002_reservations.sql.

-- ---------------------------------------------------------------------------
-- photo storage: public bucket, owners write only inside <their uid>/
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos', 'listing-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing photos are public" on storage.objects;
create policy "Listing photos are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists "Users upload own listing photos" on storage.objects;
create policy "Users upload own listing photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own listing photos" on storage.objects;
create policy "Users update own listing photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own listing photos" on storage.objects;
create policy "Users delete own listing photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
