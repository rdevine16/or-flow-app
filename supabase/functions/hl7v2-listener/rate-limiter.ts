/**
 * Simple Time-Window Rate Limiter
 *
 * In-memory rate limiter using sliding window per facility.
 * Default: 100 messages/minute, configurable via integration config.
 *
 * Note: This is per-instance — Edge Function instances don't share memory.
 * For a single-facility ASC sending 10-30 messages/day, this is sufficient.
 * If horizontal scaling becomes an issue, switch to Redis or DB-based counting.
 */

const DEFAULT_RATE_LIMIT = 100; // messages per minute
const WINDOW_MS = 60_000; // 1 minute

interface RateWindow {
  timestamps: number[];
}

// Per-facility rate tracking (in-memory, per Edge Function instance)
const windows = new Map<string, RateWindow>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterMs: number | null;
}

/**
 * Check if a request from a facility is within rate limits.
 *
 * @param facilityId - The facility making the request
 * @param configuredLimit - Per-facility limit from ehr_integrations.config.rate_limit_per_minute
 */
export function checkRateLimit(
  facilityId: string,
  configuredLimit?: number,
): RateLimitResult {
  const limit = configuredLimit ?? DEFAULT_RATE_LIMIT;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get or create window for this facility
  let window = windows.get(facilityId);
  if (!window) {
    window = { timestamps: [] };
    windows.set(facilityId, window);
  }

  // Prune expired timestamps
  window.timestamps = window.timestamps.filter(ts => ts > windowStart);

  // Check if under limit
  if (window.timestamps.length >= limit) {
    // Calculate when the oldest request in the window expires
    const oldestInWindow = window.timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;

    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  // Record this request
  window.timestamps.push(now);

  return {
    allowed: true,
    remaining: limit - window.timestamps.length,
    limit,
    retryAfterMs: null,
  };
}

/**
 * Clean up stale entries (call periodically to prevent memory growth).
 */
export function cleanupStaleWindows(): void {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  for (const [facilityId, window] of windows.entries()) {
    window.timestamps = window.timestamps.filter(ts => ts > windowStart);
    if (window.timestamps.length === 0) {
      windows.delete(facilityId);
    }
  }
}
