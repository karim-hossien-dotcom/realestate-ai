/**
 * In-memory sliding window rate limiter for Next.js API routes.
 * Works for single-instance deployments (Render free/starter tier).
 * For multi-instance, replace with Upstash Redis or Supabase-backed.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(t => now - t < 900_000) // 15 min max window
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }, 300_000)
}

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (IP, userId, or composite)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { limited: boolean, remaining: number, resetMs: number }
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { limited: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    return {
      limited: true,
      remaining: 0,
      resetMs: oldest + windowMs - now,
    }
  }

  entry.timestamps.push(now)
  return {
    limited: false,
    remaining: limit - entry.timestamps.length,
    resetMs: windowMs,
  }
}

// ── Preset configurations ──

/** General API: 60 requests per minute per user */
export function rateLimitGeneral(userId: string) {
  return checkRateLimit(`api:${userId}`, 60, 60_000)
}

/** Auth routes: 5 attempts per 15 minutes per IP */
export function rateLimitAuth(ip: string) {
  return checkRateLimit(`auth:${ip}`, 5, 900_000)
}

/** Messaging: 30 sends per minute per user */
export function rateLimitMessaging(userId: string) {
  return checkRateLimit(`msg:${userId}`, 30, 60_000)
}

/** Stripe/payment: 10 requests per minute per user */
export function rateLimitPayment(userId: string) {
  return checkRateLimit(`pay:${userId}`, 10, 60_000)
}

/** Public endpoints: 20 requests per minute per IP */
export function rateLimitPublic(ip: string) {
  return checkRateLimit(`pub:${ip}`, 20, 60_000)
}

/** Admin: 30 requests per minute per user */
export function rateLimitAdmin(userId: string) {
  return checkRateLimit(`adm:${userId}`, 30, 60_000)
}

/** Export: 5 requests per minute per user */
export function rateLimitExport(userId: string) {
  return checkRateLimit(`exp:${userId}`, 5, 60_000)
}
