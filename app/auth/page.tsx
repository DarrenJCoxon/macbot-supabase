// app/auth/page.tsx
'use client';

import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client'; // Correct relative path

export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          console.log('AuthPage: User signed in, redirecting to home...');
          router.push('/');
          router.refresh();
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]);

  const containerStyle: React.CSSProperties = {
    maxWidth: '420px',
    margin: '50px auto',
    padding: '30px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  };

  return (
    <div style={containerStyle}>
      {/* Keep heading generic or adapt */}
      <h1>Welcome to Macbot</h1>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Sign in or create an account
      </p>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
        theme="dark"
        // --- THIS IS THE KEY CHANGE ---
        showLinks={true} // Set to true to show "Sign Up" / "Forgot Password" links
        // --- END KEY CHANGE ---
      />
    </div>
  );
}