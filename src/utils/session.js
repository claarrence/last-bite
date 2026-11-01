import { supabase } from '@/utils/supabase'

// Shared session and account-role helpers.

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

// Uses the is_establishment() database function, the same check the
// listings insert policy uses, so the UI and the database always agree.
export async function isEstablishment() {
  const { data, error } = await supabase.rpc('is_establishment')
  if (error) return false
  return data === true
}

// The pickup location an establishment chose at registration, or null if none was saved.
// Pre-filling is only a convenience, so a failed lookup is treated as "no saved location".
export async function getEstablishmentLocation(establishmentId) {
  const { data, error } = await supabase
    .from('establishment')
    .select('address, lat, lng')
    .eq('id', establishmentId)
    .maybeSingle()
  if (error || !data?.address) return null
  return {
    address: data.address,
    lat: data.lat == null ? null : Number(data.lat),
    lng: data.lng == null ? null : Number(data.lng),
  }
}
