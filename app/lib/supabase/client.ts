// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'; // Updated import

// Define a function to create a Supabase client for browser components
export const createClient = () =>
  createBrowserClient(
    // Pass Supabase URL and anonymous key from environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // The '!' asserts these are defined
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// Explanation:
// - `createBrowserClient`: This function from `@supabase/ssr` creates a client
//   instance specifically designed to work safely in the browser (client components).
// - It uses the public 'anon' key.
// - The '!' tells TypeScript we're sure these environment variables will exist at runtime.
//   Make sure they are correctly set in your .env.local!