import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// False when .env is missing the Supabase settings; App.vue then shows setup steps.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// createClient throws without a URL, which would leave a blank page.
// The placeholder only lets the app start far enough to show the setup message.
export const supabase = createClient(
  supabaseUrl || 'https://not-configured.supabase.co',
  supabaseKey || 'not-configured',
)

// Supabase answers PGRST205 (table) or PGRST202 (function) when it cannot find
// them, which means that SQL file has not been run yet. Show a clear next step
// instead of the "schema cache" message.
export function explainError(error, sqlFile) {
  if (error.code === 'PGRST205' || error.code === 'PGRST202') {
    return new Error(
      `This feature is not set up yet. Run supabase/migrations/${sqlFile} in the Supabase SQL Editor.`,
    )
  }
  return error
}
