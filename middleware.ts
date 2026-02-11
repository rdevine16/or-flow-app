import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

/** Routes that are fully public — no session check at all */
const PUBLIC_ROUTES = [
  '/auth/',       // Auth callbacks, password reset, etc.
  '/invite/',     // Device rep signup flow
  '/login',       // Login page
  '/status/',     // Public case status pages
]

/**
 * API routes that must be publicly accessible.
 * All other /api/* routes require authentication at the middleware level.
 */
const PUBLIC_API_ROUTES = [
  '/api/invite/accept',       // Invite acceptance (user doesn't have account yet)
  '/api/create-device-rep',   // Device rep signup (user doesn't have account yet)
  '/api/check-auth-status',   // Auth status check (returns 401 gracefully if not authed)
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

// ============================================
// MIDDLEWARE
// ============================================

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes pass through without any session check
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Set up Supabase client with cookie handling
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ────────────────────────────────────────────
  // API route authentication
  // ────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Public API routes skip auth
    if (isPublicApiRoute(pathname)) {
      return supabaseResponse
    }

    // All other API routes require authentication
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // Attach user ID as header for downstream use (optional convenience)
    supabaseResponse.headers.set('x-user-id', user.id)
    return supabaseResponse
  }

  // ────────────────────────────────────────────
  // Page route authentication
  // ────────────────────────────────────────────

  // Not logged in → redirect to login
  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in → redirect away from login
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
