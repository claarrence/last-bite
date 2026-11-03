-- Establishment pickup location, chosen once at registration.
-- Run once in the Supabase dashboard → SQL Editor, after 004_pickup_codes.sql.
-- The listing form pre-fills new listings with this address; owners can still change it per listing.
-- Existing establishments keep null values and simply type the address as before.

alter table public.establishment
  add column if not exists address text check (char_length(address) <= 200),
  add column if not exists lat numeric,  -- null when the address was typed without a OneMap match
  add column if not exists lng numeric;

-- Make the Supabase API see the new columns straight away.
notify pgrst, 'reload schema';
