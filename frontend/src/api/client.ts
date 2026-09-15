export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let csrf: Promise<string> | undefined
export function resetSession() {
  csrf = undefined
}

export async function api<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    signal?: AbortSignal
    public?: boolean
    key?: string
    receipt?: string
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json' })
  if (options.receipt) headers.set('X-Deletion-Receipt', options.receipt)
  if (options.body !== undefined)
    headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD'].includes(method)) {
    headers.set('Idempotency-Key', options.key ?? crypto.randomUUID())
    if (!options.public) {
      csrf ??= api<{ token: string }>('/v1/auth/csrf')
        .then((v) => v.token)
        .catch((error) => {
          csrf = undefined
          throw error
        })
      headers.set('X-CSRF-Token', await csrf)
    }
  }
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    if (response.status === 403) resetSession()
    if (response.status === 401) {
      resetSession()
      window.dispatchEvent(new Event('soba:unauthenticated'))
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'request_failed',
      error?.message ??
        `The server could not complete this request (${response.status}).`,
    )
  }
  if (response.status === 204) return undefined as T
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'The API returned an unexpected response. Check the API proxy configuration.',
    )
  return response.json()
}

export async function list<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = []
  let cursor: string | null = null
  const seen = new Set<string>()
  do {
    const url = new URL(path, window.location.origin)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const page: { items: T[]; next_cursor: string | null } = await api(
      url.pathname + url.search,
      { signal },
    )
    result.push(...page.items)
    cursor = page.next_cursor
    if (cursor && seen.has(cursor))
      throw new Error('The server returned a repeated page. Please reload.')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return result
}
