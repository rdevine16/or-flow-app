import { createBrowserClient } from '@supabase/ssr'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 500

/**
 * Fetch wrapper that retries on transient network failures
 * (e.g. "Failed to fetch" from DNS hiccups, Wi-Fi transitions, sleep/wake).
 * Only retries TypeError (network-level) — HTTP error responses are NOT retried.
 */
function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let attempt = 0

  const execute = (): Promise<Response> =>
    fetch(input, init).catch((err: unknown) => {
      if (
        attempt < MAX_RETRIES &&
        err instanceof TypeError &&
        !(init?.signal?.aborted)
      ) {
        attempt++
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        return new Promise<Response>((resolve) =>
          setTimeout(() => resolve(execute()), delay),
        )
      }
      throw err
    })

  return execute()
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithRetry },
    },
  )
}