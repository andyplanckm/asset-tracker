import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, getSupabaseDashboardUrl, NETWORK_TIMEOUT_MS, withNetworkTimeout } from './network'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('withNetworkTimeout', () => {
  it('settles even when the operation ignores cancellation', async () => {
    vi.useFakeTimers()
    let operationSignal: AbortSignal | undefined
    const result = withNetworkTimeout((signal) => {
      operationSignal = signal
      return new Promise<never>(() => undefined)
    })
    const failure = expect(result).rejects.toMatchObject({ name: 'TimeoutError' })

    await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUT_MS)
    await failure
    expect(operationSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the caller abort reason and cancels the operation', async () => {
    const caller = new AbortController()
    let operationSignal: AbortSignal | undefined
    const result = withNetworkTimeout((signal) => {
      operationSignal = signal
      return new Promise<never>(() => undefined)
    }, caller.signal)
    await Promise.resolve()
    const reason = new Error('superseded refresh')
    const failure = expect(result).rejects.toBe(reason)

    caller.abort(reason)

    await failure
    expect(operationSignal?.reason).toBe(reason)
  })

  it('never starts an operation whose caller already cancelled it', async () => {
    const caller = new AbortController()
    caller.abort()
    const operation = vi.fn()

    await expect(withNetworkTimeout(operation, caller.signal)).rejects.toBe(caller.signal.reason)
    expect(operation).not.toHaveBeenCalled()
  })

  it('cleans the deadline and caller listener after success', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    let operationSignal: AbortSignal | undefined
    await expect(withNetworkTimeout(async (signal) => {
      operationSignal = signal
      return 42
    }, caller.signal)).resolves.toBe(42)

    expect(vi.getTimerCount()).toBe(0)
    caller.abort()
    expect(operationSignal?.aborted).toBe(false)
  })

  it('cancels sibling work when the operation fails before the deadline', async () => {
    let operationSignal: AbortSignal | undefined
    const error = new Error('one parallel query failed')
    const result = withNetworkTimeout(async (signal) => {
      operationSignal = signal
      throw error
    })

    await expect(result).rejects.toBe(error)
    expect(operationSignal?.reason).toBe(error)
  })
})

describe('fetchWithTimeout', () => {
  it('also bounds a response that returns headers but stalls in the body', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (_input, init: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          init.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true })
        },
      })
      return new Response(body, { headers: { 'Content-Type': 'application/json' } })
    }))
    const result = fetchWithTimeout('https://example.supabase.co/rest/v1/accounts')
    const failure = expect(result).rejects.toMatchObject({ name: 'TimeoutError' })

    await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUT_MS)

    await failure
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves a signal carried by the input Request', async () => {
    const caller = new AbortController()
    const request = new Request('https://example.supabase.co/rest/v1/accounts', { signal: caller.signal })
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    const result = fetchWithTimeout(request)
    await Promise.resolve()
    const reason = new Error('request cancelled')
    const failure = expect(result).rejects.toBe(reason)

    caller.abort(reason)

    await failure
    expect(fetchMock.mock.calls).toHaveLength(1)
  })

  it('returns the original successful response with its body still readable', async () => {
    const response = new Response('{"ok":true}', { status: 201, headers: { 'X-Request-Id': 'test' } })
    vi.stubGlobal('fetch', vi.fn(async () => response))

    const result = await fetchWithTimeout('https://example.supabase.co/rest/v1/accounts')

    expect(result).toBe(response)
    expect(result.status).toBe(201)
    expect(result.headers.get('X-Request-Id')).toBe('test')
    await expect(result.json()).resolves.toEqual({ ok: true })
  })
})

describe('getSupabaseDashboardUrl', () => {
  it('links only actual hosted Supabase projects to their console', () => {
    expect(getSupabaseDashboardUrl('https://abcdefgh.supabase.co')).toBe('https://supabase.com/dashboard/project/abcdefgh')
    for (const value of [
      'https://abcdefgh.supabase.co.attacker.test',
      'https://supabase.co',
      'https://not-supabase.co',
      'https://user:password@abcdefgh.supabase.co',
      'http://abcdefgh.supabase.co',
      'http://localhost:54321',
      'not a URL',
    ]) {
      expect(getSupabaseDashboardUrl(value)).toBeNull()
    }
  })
})
