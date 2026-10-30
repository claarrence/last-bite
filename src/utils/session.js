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
