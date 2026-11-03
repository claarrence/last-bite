import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOneMapHandler } from '../../../supabase/functions/_shared/onemap.js'

const request = (query = 'mode=search&query=200640') =>
  new Request(`http://localhost/api/onemap?${query}`)
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
afterEach(() => vi.unstubAllGlobals())

describe('server-side OneMap adapter', () => {
  it('authenticates once and keeps credentials out of the browser response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          access_token: 'test-token',
          expiry_timestamp: Math.floor(Date.now() / 1000) + 7200,
        }),
      )
      .mockResolvedValue(
        json({
          results: [{ ADDRESS: '640 ROWELL ROAD', LATITUDE: '1.3074', LONGITUDE: '103.8547' }],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const handle = createOneMapHandler({ email: 'test@example.com', password: 'test-password' })
    const response = await handle(request())
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain('640 ROWELL ROAD')
    expect(body).not.toContain('test-token')
    expect(body).not.toContain('test-password')
    await handle(request())
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('test-token')
    const url = new URL(fetchMock.mock.calls[1][0])
    expect(url.searchParams.get('returnGeom')).toBe('Y')
    expect(url.searchParams.get('getAddrDetails')).toBe('Y')
  })

  it('renews a token when OneMap returns an authentication error with HTTP 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: 'Authentication token expired.', results: [] }))
      .mockResolvedValueOnce(
        json({
          access_token: 'renewed-token',
          expiry_timestamp: Math.floor(Date.now() / 1000) + 7200,
        }),
      )
      .mockResolvedValueOnce(json({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const handle = createOneMapHandler({
      token: 'expired-token',
      email: 'test@example.com',
      password: 'test-password',
    })
    const response = await handle(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ results: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('renewed-token')
  })

  it('searches without a token when no credentials are configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        error: 'Authentication token missing.',
        results: [{ ADDRESS: '640 ROWELL ROAD', LATITUDE: '1.3074', LONGITUDE: '103.8547' }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const response = await createOneMapHandler()(request())
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('640 ROWELL ROAD')
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined()
  })

  it('shows a configuration error for map pins when no credentials are configured', async () => {
    const response = await createOneMapHandler()(request('mode=reverse&lat=1.35&lng=103.85'))
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('not configured')
  })

  it('rejects bad coordinates and short queries without contacting OneMap', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handle = createOneMapHandler({ token: 'test-token' })
    expect((await handle(request('mode=reverse&lat=&lng=103.85'))).status).toBe(400)
    expect((await handle(request('mode=reverse&lat=10&lng=103.85'))).status).toBe(400)
    expect((await handle(request('mode=search&query=ab'))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses OneMap reverse geocoding for a valid pin and sanitizes upstream failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ GeocodeInfo: [{ BLOCK: '640', ROAD: 'ROWELL ROAD' }] }))
      .mockResolvedValueOnce(json({ error: 'Private upstream diagnostic' }, 429))
    vi.stubGlobal('fetch', fetchMock)
    const handle = createOneMapHandler({ token: 'test-token' })
    const response = await handle(request('mode=reverse&lat=1.3074&lng=103.8547'))
    expect((await response.json()).GeocodeInfo[0].ROAD).toBe('ROWELL ROAD')
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/api/public/revgeocode')
    const error = await handle(request())
    expect(error.status).toBe(503)
    expect(await error.text()).not.toContain('Private upstream diagnostic')
  })
})

describe('deployed OneMap function authentication', () => {
  async function loadFunction() {
    let handler
    const env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_PUBLISHABLE_KEYS: '{"default":"test-publishable"}',
      ONEMAP_TOKEN: 'test-token',
    }
    vi.stubGlobal('Deno', {
      env: { get: (name) => env[name] },
      serve: (callback) => {
        handler = callback
      },
    })
    vi.resetModules()
    await import('../../../supabase/functions/onemap/index.ts')
    return handler
  }

  const pinLookup = 'mode=reverse&lat=1.3197&lng=103.8426'

  it('rejects an invalid session before a pin lookup calls OneMap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'invalid session' }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const handle = await loadFunction()
    const response = await handle(request(pinLookup))
    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://test.supabase.co/auth/v1/user')
  })

  it('passes an authenticated pin lookup to OneMap without exposing its token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 'test-user' }))
      .mockResolvedValueOnce(json({ GeocodeInfo: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const handle = await loadFunction()
    const response = await handle(
      new Request(`https://test.supabase.co/functions/v1/onemap?${pinLookup}`, {
        headers: { Authorization: 'Bearer test-user-session' },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ GeocodeInfo: [] })
    expect(fetchMock.mock.calls[0][1].headers.apikey).toBe('test-publishable')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-user-session')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('test-token')
  })

  // Establishments search for their location while registering, before they are logged in.
  it('lets logged-out visitors search addresses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const handle = await loadFunction()
    const response = await handle(request())
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain(
      'https://www.onemap.gov.sg/api/common/elastic/search',
    )
  })
})
