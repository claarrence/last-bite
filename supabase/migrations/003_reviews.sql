-- Feature 5: Rate and Review Establishments After Pickup
-- Run once in the Supabase dashboard → SQL Editor, after 002_reservations.sql.
--
-- Rules enforced here (not only in the UI):
--   * Only the customer of a COLLECTED reservation can review it, once.
--   * The review must point at that reservation's listing and its provider.
--   * Authors edit or delete only their own review (rating, tags, comment, photo).
--   * Providers can only write or edit the public reply on reviews of their food.
--   * Anyone can read reviews, so establishment summaries are public.

create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  -- unique: one review per collected reservation
  reservation_id   uuid not null unique references public.reservations (id) on delete cascade,
  listing_id       uuid not null references public.listings (id) on delete cascade,
  establishment_id uuid not null references auth.users (id) on delete cascade,
  author_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating           integer not null check (rating between 1 and 5),
  tags             text[] not null default '{}'
                   check (tags <@ array['Fresh', 'As described', 'Generous portion', 'Easy to find']),
  comment          text check (char_length(comment) <= 500),
  photo_path       text not null default '',
  reply            text check (char_length(reply) <= 500),
  replied_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists reviews_establishment_idx on public.reviews (establishment_id);
create index if not exists reviews_author_idx on public.reviews (author_id);

-- ---------------------------------------------------------------------------
-- Who may change which columns (row-level policies cannot limit columns).
-- ---------------------------------------------------------------------------
create or replace function public.reviews_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.reservation_id <> old.reservation_id
     or new.listing_id <> old.listing_id
     or new.establishment_id <> old.establishment_id
     or new.author_id <> old.author_id then
    raise exception 'A review cannot be moved to another reservation.';
  end if;

  if auth.uid() = old.author_id then
    -- The author edits their review but cannot write the provider's reply.
    if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
      raise exception 'Only the provider can reply to a review.';
    end if;
  elsif auth.uid() = old.establishment_id then
    -- The provider can change only the reply.
    if new.rating <> old.rating
       or new.tags <> old.tags
       or new.comment is distinct from old.comment
       or new.photo_path <> old.photo_path then
      raise exception 'Providers can only reply to reviews.';
    end if;
    new.replied_at := case when new.reply is null or new.reply = '' then null else now() end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_before_update on public.reviews;
create trigger reviews_before_update
  before update on public.reviews
  for each row execute function public.reviews_before_update();

-- ---------------------------------------------------------------------------
-- Access rules (RLS)
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

drop policy if exists "Anyone can read reviews" on public.reviews;
create policy "Anyone can read reviews"
  on public.reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "Customers review their collected reservations" on public.reviews;
create policy "Customers review their collected reservations"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.reservations r
      join public.listings l on l.id = r.listing_id
      where r.id = reservation_id
        and r.customer_id = auth.uid()
        and r.status = 'collected'
        and l.id = listing_id
        and l.owner_id = establishment_id
    )
  );

drop policy if exists "Authors and providers update reviews" on public.reviews;
create policy "Authors and providers update reviews"
  on public.reviews for update
  to authenticated
  using (author_id = auth.uid() or establishment_id = auth.uid())
  with check (author_id = auth.uid() or establishment_id = auth.uid());

drop policy if exists "Authors delete own reviews" on public.reviews;
create policy "Authors delete own reviews"
  on public.reviews for delete
  to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public establishment name and type for the reviews page. security definer so
-- it works whatever the establishment table's own access rules are, while only
-- exposing these two columns.
-- ---------------------------------------------------------------------------
create or replace function public.establishment_profile(p_id uuid)
returns table (id uuid, name text, business_type text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name, e.business_type from public.establishment e where e.id = p_id;
$$;

revoke all on function public.establishment_profile(uuid) from public;
grant execute on function public.establishment_profile(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Review photos: public bucket, authors write only inside <their uid>/
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos', 'review-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Review photos are public" on storage.objects;
create policy "Review photos are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'review-photos');

drop policy if exists "Users upload own review photos" on storage.objects;
create policy "Users upload own review photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own review photos" on storage.objects;
create policy "Users delete own review photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
