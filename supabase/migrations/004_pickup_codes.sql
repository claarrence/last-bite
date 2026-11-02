-- Shorter pickup references: 6 digits (e.g. 482913) instead of LB-3F9A2C.
-- Run once in the Supabase dashboard → SQL Editor, after 002_reservations.sql.
-- Existing reservations keep their old reference, which still works.

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
    -- A random number from 000000 to 999999, padded to 6 digits.
    v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    exit when not exists (select 1 from public.reservations where pickup_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.new_pickup_code() from public, anon, authenticated;
