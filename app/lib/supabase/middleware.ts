// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Updated import
import { type NextRequest, NextResponse } from 'next/server';

// Define a function to create a Supabase client specifically for Middleware
export const createSupabaseMiddlewareClient = (req: NextRequest, res: NextResponse) => { // Renamed function
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Middleware uses the request and response objects directly
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          // The response object is used to set the cookie header
          res.cookies.set({
              name,
              value,
              ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
           // The response object is used to set the cookie header
          res.cookies.set({
              name,
              value: '',
              ...options,
          });
        },
      },
    }
  );
};