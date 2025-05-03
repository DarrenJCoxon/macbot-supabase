// lib/supabase/server.ts
// Remove the unused import for createServerClient
// import { createServerClient } from '@supabase/ssr';

// Import the helper we are actually using
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

import { cookies } from 'next/headers';
import type { cookies as CookiesFn } from 'next/headers';

// Define the expected return type of the cookies function
type CookieStore = ReturnType<typeof CookiesFn>;

export const createSupabaseServerClient = () => {
  const cookieStore: CookieStore = cookies();

  // Use createRouteHandlerClient
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  console.log("Using createRouteHandlerClient for server client instance.");

  return supabase;
};

// Keep the createServerClient version commented out as a fallback
/*
import { createServerClient } from '@supabase/ssr'; // Needs @supabase/ssr installed

export const createSupabaseServerClient_SSR = () => {
  const cookieStore: CookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try { return cookieStore.get(name)?.value; }
          catch (error) { console.error(`Error getting cookie "${name}"...`, error); return undefined; }
        },
        set() { },
        remove() { },
      },
    }
  );
};
*/