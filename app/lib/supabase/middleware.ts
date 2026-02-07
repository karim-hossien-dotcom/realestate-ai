import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function updateSession(request: NextRequest) {
  // Check public API routes FIRST - skip all auth for these
  const isPublicApiRoute = request.nextUrl.pathname === '/api/whatsapp/webhook' ||
                           request.nextUrl.pathname.startsWith('/api/cron/') ||
                           request.nextUrl.pathname === '/api/whatsapp/send' ||
                           request.nextUrl.pathname === '/api/email/send'

  if (isPublicApiRoute) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define protected and auth routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/prototype') ||
                           request.nextUrl.pathname.startsWith('/api/')
  const isAuthRoute = request.nextUrl.pathname === '/'

  // Redirect unauthenticated users from protected routes to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from auth page to prototype
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/prototype'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
