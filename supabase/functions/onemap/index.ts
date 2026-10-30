// Supabase uses index.ts as its entry point; this file uses plain JavaScript syntax.
import { createOneMapHandler } from '../_shared/onemap.js'

const publicKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
const supabaseKey =
  publicKeys.default || Object.values(publicKeys)[0] || Deno.env.get('SUPABASE_ANON_KEY')

const handler = createOneMapHandler({
  email: Deno.env.get('ONEMAP_EMAIL'),
  password: Deno.env.get('ONEMAP_PASSWORD'),
  token: Deno.env.get('ONEMAP_TOKEN'),
  allowedOrigin: Deno.env.get('ONEMAP_ALLOWED_ORIGIN') || '*',
})

// Validate the user's session through Supabase Auth, including with new publishable keys.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handler(request)
  const authorization = request.headers.get('authorization') || ''
  const cors = {
    'Access-Control-Allow-Origin': Deno.env.get('ONEMAP_ALLOWED_ORIGIN') || '*',
    'Content-Type': 'application/json',
  }
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: supabaseKey },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok)
      return new Response(JSON.stringify({ error: 'Log in to search addresses.' }), {
        status: 401,
        headers: cors,
      })
    return handler(request)
  } catch {
    return new Response(JSON.stringify({ error: 'Map search is unavailable.' }), {
      status: 503,
      headers: cors,
    })
  }
})
