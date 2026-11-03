// Server-only OneMap adapter. Used by Vite locally and a Supabase function after deployment.
// Official API: https://www.onemap.gov.sg/apidocs/search
export function createOneMapHandler({ email, password, token, allowedOrigin = '*' } = {}) {
  let accessToken = token || ''
  let expiresAt = token ? Infinity : 0
  let tokenRequest = null
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers })

  async function getToken(refresh = false) {
    if (!refresh && accessToken && Date.now() < expiresAt - 60000) return accessToken
    if (!email || !password)
      throw new Error('OneMap is not configured. Enter the pickup address manually.')
    // Share an in-flight renewal so simultaneous searches do not each request a token.
    if (!tokenRequest) {
      tokenRequest = (async () => {
        const response = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(10000),
        })
        const data = await response.json()
        if (!response.ok || !data.access_token)
          throw new Error('OneMap authentication failed. Enter the pickup address manually.')
        accessToken = data.access_token
        expiresAt = Number(data.expiry_timestamp) * 1000
        return accessToken
      })().finally(() => {
        tokenRequest = null
      })
    }
    return tokenRequest
  }

  async function requestApi(path, params, refresh = false) {
    // Search still returns results without a token (alongside a "token missing" warning), so
    // address autocomplete keeps working when no credentials are configured.
    const hasCredentials = Boolean(token || (email && password))
    if (path === 'common/elastic/search' && !hasCredentials) {
      const response = await fetch(`https://www.onemap.gov.sg/api/${path}?${params}`, {
        signal: AbortSignal.timeout(10000),
      })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.results))
        throw new Error('OneMap is not configured. Enter the pickup address manually.')
      return data
    }

    const authorization = await getToken(refresh)
    const response = await fetch(`https://www.onemap.gov.sg/api/${path}?${params}`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    })
    const data = await response.json()
    // Search can report authentication errors inside an HTTP 200 response.
    const authError =
      response.status === 401 || /token|authentication/i.test(String(data.error || ''))
    if (authError && !refresh && email && password) return requestApi(path, params, true)
    if (!response.ok || data.error) {
      if (authError)
        throw new Error('OneMap authentication failed. Enter the pickup address manually.')
      throw new Error('OneMap is unavailable. Enter the pickup address manually.')
    }
    return data
  }

  return async function handleOneMap(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'GET') return reply({ error: 'Method not allowed.' }, 405)
    const params = new URL(request.url).searchParams
    const mode = params.get('mode')
    let path, query
    if (mode === 'search') {
      const searchVal = (params.get('query') || '').trim()
      if (searchVal.length < 3 || searchVal.length > 120)
        return reply({ error: 'Enter 3–120 characters.' }, 400)
      path = 'common/elastic/search'
      query = new URLSearchParams({ searchVal, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' })
    } else if (mode === 'reverse') {
      const lat = Number(params.get('lat'))
      const lng = Number(params.get('lng'))
      if (
        !params.get('lat') ||
        !params.get('lng') ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < 1.144 ||
        lat > 1.494 ||
        lng < 103.535 ||
        lng > 104.502
      ) {
        return reply({ error: 'Choose a location in Singapore.' }, 400)
      }
      path = 'public/revgeocode'
      query = new URLSearchParams({ location: `${lat},${lng}`, buffer: '50', addressType: 'All' })
    } else {
      return reply({ error: 'Unknown map request.' }, 400)
    }
    try {
      const data = await requestApi(path, query)
      return reply(
        mode === 'search'
          ? { results: (data.results || []).slice(0, 8) }
          : { GeocodeInfo: data.GeocodeInfo || [] },
      )
    } catch (error) {
      const message = error.message.startsWith('OneMap')
        ? error.message
        : 'OneMap is unavailable. Enter the pickup address manually.'
      return reply({ error: message }, 503)
    }
  }
}
