// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Keep this import

// --- Helper Function Code Integrated ---
const createSupabaseMiddlewareClientInternal = (req: NextRequest, res: NextResponse) => {
  // Define the helper function logic directly here
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
};
// --- End Integrated Helper Code ---


export async function middleware(req: NextRequest) {
    console.log(`Middleware processing: ${req.method} ${req.nextUrl.pathname}`);
    const res = NextResponse.next();

    // Call the internally defined function
    const supabase = createSupabaseMiddlewareClientInternal(req, res);

    console.log('Middleware: Attempting to get/refresh session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('Middleware: Error getting session:', sessionError.message);
        return res; // Allow request but log error
    }

    const protectedRoutes = ['/chat', '/admin'];
    const authRoute = '/'; // Login is now the root route
    const { pathname } = req.nextUrl;

    // --- AUTHENTICATION LOGIC ---
    if (!session && protectedRoutes.some(route => pathname.startsWith(route))) {
        console.log(`Middleware: No session, redirecting from ${pathname} to ${authRoute}`);
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = authRoute;
        redirectUrl.searchParams.set('redirectedFrom', pathname);
        return NextResponse.redirect(redirectUrl);
    }
    if (session && pathname === authRoute) {
         console.log(`Middleware: Session found, redirecting from ${pathname} to /chat`);
         const redirectUrl = req.nextUrl.clone();
         redirectUrl.pathname = '/chat';
         return NextResponse.redirect(redirectUrl);
    }
    // --- END AUTHENTICATION LOGIC ---

    return res; // Return potentially modified response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - *.png, *.jpg, etc. (image files in /public)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)',
    ],
};