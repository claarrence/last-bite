import { Buffer } from 'node:buffer'

// Isolated provider responses: no real accounts or profiles are created.
export const userId = '11111111-1111-4111-8111-111111111111'
export const user = { id: userId, email: 'test@example.com', app_metadata: {}, user_metadata: {} }
const encode = (data) => Buffer.from(JSON.stringify(data)).toString('base64url')
const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.test-signature`
export const session = {
  user,
  access_token: accessToken,
  refresh_token: 'test-refresh',
  expires_in: 3600,
  token_type: 'bearer',
}
