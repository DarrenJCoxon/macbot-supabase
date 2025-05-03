// middleware.ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Utility function to create client WITHIN middleware
const createClient = (req: NextRequest) => {
    // --- FIXED: Use const ---
    // Create an unmodified response object first
    const response = NextResponse.next({ // Changed let to const
        request: {
            headers: new Headers(req.headers),
        },
    });
    // --- END FIXED ---

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    req.cookies.set({ name, value, ...options });
                    // Mutate the response object's cookies
                    response.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    req.cookies.set({ name, value: '', ...options });
                     // Mutate the response object's cookies
                    response.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );
    // Return both the client and the (potentially mutated) response
    return { supabase, response };
};


export async function middleware(req: NextRequest) {
    const { supabase, response } = createClient(req);

    // --- Session Refresh ---
    console.log('Middleware: Refreshing session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) { console.error('Middleware: Error getting session:', error); }
    else if (session) { console.log('Middleware: Session found/refreshed.'); }
    else { console.log('Middleware: No session found.'); }
    // --- End Session Refresh ---

    // --- Optional: Route Protection ---
    const { pathname } = req.nextUrl;
    if (!session && (pathname.startsWith('/app') || pathname.startsWith('/dashboard'))) { // Adjust protected paths
       console.log('Middleware: No session, redirecting to /auth from protected route:', pathname);
       const redirectUrl = req.nextUrl.clone();
       redirectUrl.pathname = '/auth';
       return NextResponse.redirect(redirectUrl);
    }
    if (session && pathname === '/auth') {
        console.log('Middleware: Session found, redirecting from /auth to /');
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/';
        return NextResponse.redirect(redirectUrl);
    }
    // --- End Optional: Route Protection ---

    // Return the potentially modified response object
    return response;
}

// --- Middleware Configuration ---
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|parchment-bg.png).*)', // Add your static assets here
  ],
};