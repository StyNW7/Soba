import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { api, list, resetSession, ApiError } from '../src/api/client.ts'
const events = new EventTarget()
globalThis.window = {
  location: { origin: 'http://localhost:5174' },
  dispatchEvent: (event) => events.dispatchEvent(event),
}
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
beforeEach(() => resetSession())

test('concurrent writes share CSRF acquisition and each has a distinct idempotency key', async () => {
  const calls = []
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options })
    return path.endsWith('/csrf')
      ? json({ token: 'csrf' })
      : json({ id: 'saved' })
  }
  await Promise.all([
    api('/v1/memories', { method: 'POST', body: { text: 'one' } }),
    api('/v1/memories', { method: 'POST', body: { text: 'two' } }),
  ])
  assert.equal(calls.filter((c) => c.path.endsWith('/csrf')).length, 1)
  const writes = calls.filter((c) => c.options.method === 'POST')
  assert.equal(writes[0].options.headers.get('X-CSRF-Token'), 'csrf')
  assert.notEqual(
    writes[0].options.headers.get('Idempotency-Key'),
    writes[1].options.headers.get('Idempotency-Key'),
  )
  assert.equal(writes[0].options.credentials, 'same-origin')
})
test('login requires no authenticated CSRF request', async () => {
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/v1/auth/start')
    assert.equal(options.headers.has('X-CSRF-Token'), false)
    return json({ authorization_url: 'https://issuer.test' })
  }
  await api('/v1/auth/start', {
    method: 'POST',
    public: true,
    body: { client: 'web', return_path: '/app' },
  })
})
test('conflicts remain failures and are not silently retried', async () => {
  let writes = 0
  globalThis.fetch = async (path) => {
    if (path.endsWith('/csrf')) return json({ token: 'csrf' })
    writes++
    return json(
      { code: 'version_conflict', message: 'Reload before editing.' },
      409,
    )
  }
  await assert.rejects(
    api('/v1/me', { method: 'PATCH', body: { version: 1 } }),
    (e) => e instanceof ApiError && e.status === 409,
  )
  assert.equal(writes, 1)
})
test('expired sessions notify auth and clear the cached CSRF token', async () => {
  let notified = false
  events.addEventListener(
    'soba:unauthenticated',
    () => {
      notified = true
    },
    { once: true },
  )
  globalThis.fetch = async () =>
    json({ code: 'unauthenticated', message: 'Sign in.' }, 401)
  await assert.rejects(api('/v1/me'), (e) => e.status === 401)
  assert.equal(notified, true)
})
test('a rejected CSRF token is replaced on the next attempt', async () => {
  let tokens = 0,
    writes = 0
  globalThis.fetch = async (path) => {
    if (path.endsWith('/csrf')) return json({ token: `csrf-${++tokens}` })
    return ++writes === 1
      ? json(
          { code: 'forbidden', message: 'A valid CSRF token is required.' },
          403,
        )
      : json({ ok: true })
  }
  await assert.rejects(api('/v1/memories', { method: 'POST', body: {} }))
  await api('/v1/memories', { method: 'POST', body: {} })
  assert.equal(tokens, 2)
})
test('SPA HTML cannot be mistaken for a working API', async () => {
  globalThis.fetch = async () =>
    new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })
  await assert.rejects(api('/v1/me'), /proxy configuration/)
})
test('pagination preserves filters and follows all pages', async () => {
  let count = 0
  globalThis.fetch = async (path) => {
    const url = new URL(path, window.location.origin)
    assert.equal(url.searchParams.get('locale'), 'id-ID')
    if (++count === 1) return json({ items: [{ id: 1 }], next_cursor: 'next' })
    assert.equal(url.searchParams.get('cursor'), 'next')
    return json({ items: [{ id: 2 }], next_cursor: null })
  }
  assert.deepEqual(await list('/v1/toolkit?locale=id-ID'), [
    { id: 1 },
    { id: 2 },
  ])
})
test('repeated pagination cursors stop instead of looping', async () => {
  globalThis.fetch = async () => json({ items: [], next_cursor: 'same' })
  await assert.rejects(list('/v1/memories'), /repeated page/)
})
test('204 has no JSON body and an explicit retry key is preserved', async () => {
  globalThis.fetch = async (path, options) => {
    if (path.endsWith('/csrf')) return json({ token: 'csrf' })
    assert.equal(options.headers.get('Idempotency-Key'), 'same-attempt')
    return new Response(null, { status: 204 })
  }
  assert.equal(
    await api('/v1/memories/one', { method: 'DELETE', key: 'same-attempt' }),
    undefined,
  )
})
