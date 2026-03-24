import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/app/lib/supabase/middleware'
import { checkRateLimit } from '@/app/lib/rate-limit'

// Routes that skip rate limiting entirely
const SKIP_RATE_LIMIT = ['/api/stripe/webhook', '/api/health', '/_next', '/favicon.ico']

// Auth routes: stricter limits (5 per 15 min per IP)
const AUTH_PATHS = ['/auth', '/api/auth', '/reset-password']

// Public routes: moderate limits (20 per min per IP)
const PUBLIC_API_PATHS = ['/api/stripe/plans', '/api/email/unsubscribe']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip rate limiting for webhooks, health, static
  if (SKIP_RATE_LIMIT.some(p => pathname.startsWith(p))) {
    return await updateSession(request)
  }

  // Only rate limit API routes and auth
  if (pathname.startsWith('/api/') || AUTH_PATHS.some(p => pathname.startsWith(p))) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    // Auth routes: 5 attempts per 15 minutes per IP
    if (AUTH_PATHS.some(p => pathname.startsWith(p))) {
      const result = checkRateLimit(`auth:${ip}`, 5, 900_000)
      if (result.limited) {
        return NextResponse.json(
          { ok: false, error: 'Too many attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(result.resetMs / 1000)) } }
        )
      }
    }
    // Public API endpoints: 20 per minute per IP
    else if (PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) {
      const result = checkRateLimit(`pub:${ip}`, 20, 60_000)
      if (result.limited) {
        return NextResponse.json(
          { ok: false, error: 'Rate limit exceeded.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(result.resetMs / 1000)) } }
        )
      }
    }
    // All other API routes: 60 per minute per IP
    else if (pathname.startsWith('/api/')) {
      const result = checkRateLimit(`api:${ip}`, 60, 60_000)
      if (result.limited) {
        return NextResponse.json(
          { ok: false, error: 'Rate limit exceeded.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(result.resetMs / 1000)) } }
        )
      }
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
