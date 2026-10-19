export const NETWORK_TIMEOUT_MS = 20_000

/** Bound the entire operation, including SDK locks and response body reads. */
export async function withNetworkTimeout<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  signal?: AbortSignal | null,
  timeoutMs = NETWORK_TIMEOUT_MS,
): Promise<T> {
  if (signal?.aborted) throw signal.reason

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abortFromCaller, { once: true })

  const timer = setTimeout(() => {
    controller.abort(new DOMException('Network request timed out', 'TimeoutError'))
  }, timeoutMs)

  let rejectOnAbort: () => void = () => undefined
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true })
  })

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      aborted,
    ])
  } catch (error) {
    // An early failure in one parallel query must also stop its siblings.
    controller.abort(error)
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortFromCaller)
    controller.signal.removeEventListener('abort', rejectOnAbort)
  }
}

/** Supabase JSON APIs are small; finish the body before releasing the deadline. */
export const fetchWithTimeout: typeof fetch = async (input, init) => {
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)

  return withNetworkTimeout(async (requestSignal) => {
    const response = await fetch(input, { ...init, signal: requestSignal })
    // Reading a clone keeps the native response URL, headers and body interface.
    // It also catches a server that returns headers but then stops sending data.
    if (response.body) await response.clone().arrayBuffer()
    return response
  }, signal)
}

export function getSupabaseDashboardUrl(supabaseUrl: string): string | null {
  try {
    const url = new URL(supabaseUrl)
    const projectRef = /^([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1]
    if (url.protocol !== 'https:' || url.username || url.password || !projectRef) return null
    return `https://supabase.com/dashboard/project/${projectRef}`
  } catch {
    return null
  }
}
