import http from 'node:http'
import { generateKeyPairSync, randomUUID, createHash, sign } from 'node:crypto'

if (process.env.SOBA_TEST_OIDC !== 'true')
  throw new Error(
    'This provider is for isolated integration tests only. Set SOBA_TEST_OIDC=true explicitly.',
  )
const issuer = 'http://127.0.0.1:9099'
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'integration',
  use: 'sig',
  alg: 'RS256',
}
const flows = new Map()
const codes = new Map()
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url')
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, issuer)
  const json = (status, value) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(value))
  }
  if (url.pathname === '/.well-known/openid-configuration')
    return json(200, {
      issuer,
      authorization_endpoint: issuer + '/authorize',
      token_endpoint: issuer + '/token',
      jwks_uri: issuer + '/jwks',
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
    })
  if (url.pathname === '/jwks') return json(200, { keys: [jwk] })
  if (url.pathname === '/authorize') {
    if (
      url.searchParams.get('redirect_uri') !==
        'http://localhost:5174/v1/auth/callback' ||
      url.searchParams.get('client_id') !== 'soba-integration'
    )
      return json(400, { error: 'invalid_client' })
    const id = randomUUID()
    flows.set(id, Object.fromEntries(url.searchParams))
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    })
    return res.end(
      `<h1>SOBA test identity provider</h1><p>Test accounts only. No Google account is used.</p><a href="/choose?flow=${id}&account=user">Sign in as test user</a><br><a href="/choose?flow=${id}&account=guardian">Sign in as test guardian</a>`,
    )
  }
  if (url.pathname === '/choose') {
    const flow = flows.get(url.searchParams.get('flow'))
    flows.delete(url.searchParams.get('flow'))
    if (!flow) return json(400, { error: 'expired_flow' })
    const code = randomUUID()
    codes.set(code, {
      ...flow,
      sub: url.searchParams.get('account') === 'guardian' ? 'guardian' : 'user',
      created: Date.now(),
    })
    const callback = new URL(flow.redirect_uri)
    callback.searchParams.set('code', code)
    callback.searchParams.set('state', flow.state)
    res.writeHead(302, { Location: callback.href })
    return res.end()
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 8192) return json(400, { error: 'invalid_request' })
    }
    const form = new URLSearchParams(body)
    const flow = codes.get(form.get('code'))
    codes.delete(form.get('code'))
    if (
      !flow ||
      Date.now() - flow.created > 60000 ||
      createHash('sha256')
        .update(form.get('code_verifier') ?? '')
        .digest('base64url') !== flow.code_challenge
    )
      return json(400, { error: 'invalid_grant' })
    const now = Math.floor(Date.now() / 1000)
    const unsigned =
      encode({ alg: 'RS256', kid: 'integration', typ: 'JWT' }) +
      '.' +
      encode({
        iss: issuer,
        aud: 'soba-integration',
        sub: flow.sub,
        name: flow.sub === 'guardian' ? 'Test Guardian' : 'Test User',
        nonce: flow.nonce,
        iat: now,
        exp: now + 300,
        auth_time: now,
      })
    return json(200, {
      access_token: randomUUID(),
      token_type: 'Bearer',
      expires_in: 300,
      id_token:
        unsigned +
        '.' +
        sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString(
          'base64url',
        ),
    })
  }
  json(404, { error: 'not_found' })
})
server.listen(9099, '127.0.0.1', () =>
  console.log('Test OIDC provider listening on loopback port 9099'),
)
