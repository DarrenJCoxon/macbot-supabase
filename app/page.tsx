// app/page.tsx (New Landing/Auth Page)
'use client';

import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styled from 'styled-components';
import { createClient } from './lib/supabase/client'; // Adjust path if needed

// --- Styled Components ---
const AuthPageContainer = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background-color: ${props => props.theme.colors.background};
  background-image: url('/parchment-bg.png'); // Ensure this image is in /public
  background-size: cover;
  background-attachment: fixed; // Optional: keep background fixed during scroll
  font-family: ${props => props.theme.fonts.body};
  color: ${props => props.theme.colors.text};
`;

const ContentBox = styled.div`
  background-color: rgba(248, 244, 233, 0.9); // Slightly more opaque parchment
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: 2rem 3rem;
  max-width: 550px;
  width: 100%;
  text-align: center;
  box-shadow: ${props => props.theme.shadows.large};
  backdrop-filter: blur(2px); // Slight blur effect on background behind the box
`;

const Title = styled.h1`
  font-family: ${props => props.theme.fonts.heading};
  color: ${props => props.theme.colors.primary};
  font-size: 2.8rem;
  margin-bottom: 0.5rem;
  &:before, &:after { content: '📜'; margin: 0 10px; } // Scroll icons
`;

const Subtitle = styled.p`
  font-family: ${props => props.theme.fonts.heading};
  font-style: italic;
  color: ${props => props.theme.colors.textLight};
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
`;

const BardImageContainer = styled.div`
  margin: 1.5rem 0;
  img { // Style the Image component within
    border-radius: 50%;
    border: 3px solid ${props => props.theme.colors.gold};
    box-shadow: ${props => props.theme.shadows.medium};
  }
`;

const Quote = styled.blockquote`
  font-family: ${props => props.theme.fonts.body};
  font-style: italic;
  font-size: 0.95rem;
  color: ${props => props.theme.colors.primaryDark};
  margin: 1.5rem auto;
  padding: 0.5rem 1rem;
  border-left: 3px solid ${props => props.theme.colors.gold};
  max-width: 90%; // Allow slightly wider quotes
  line-height: 1.5;

  cite {
    display: block;
    text-align: right;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: ${props => props.theme.colors.textLight};
  }
`;

const AuthWrapper = styled.div`
  margin-top: 2rem;
  /* Basic Theme Overrides for Supabase Auth UI */
  --colors-brand: ${props => props.theme.colors.secondary};
  --colors-brandAccent: ${props => props.theme.colors.secondaryLight};
  --colors-inputBackground: ${props => props.theme.colors.background};
  --colors-inputText: ${props => props.theme.colors.text};
  --border-radius-medium: ${props => props.theme.borderRadius.medium};
  --fonts-body: ${props => props.theme.fonts.body};
  --fonts-heading: ${props => props.theme.fonts.heading};

  /* You might need more specific selectors if the above don't work */
  .supabase-auth-ui_ui-label label,
  .supabase-auth-ui_ui-anchor a {
     color: ${props => props.theme.colors.textLight};
     &:hover {
        color: ${props => props.theme.colors.secondary};
     }
  }
`;
// --- End Styled Components ---


export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Listener for sign-in events
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => { // Capture event only, session removed as it's unused
        if (event === 'SIGNED_IN') {
          console.log('AuthPage: User signed in, redirecting to /chat...');
          router.push('/chat'); // Redirect to the NEW chat page
          router.refresh();
        }
        // Optional: Handle sign out if you implement it elsewhere
        // if (event === 'SIGNED_OUT') {
        //   router.push('/');
        //   router.refresh();
        // }
      }
    );

    // Check if user is ALREADY logged in when the page loads
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('AuthPage: Existing session detected on mount, redirecting to /chat...');
        router.push('/chat'); // Redirect immediately if already logged in
      } else {
        console.log('AuthPage: No active session on mount.');
      }
    };

    checkSession(); // Check session when component mounts

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]); // Dependencies for useEffect


  return (
    <AuthPageContainer>
      <ContentBox>
        <Title>Hark, Traveler!</Title>
        <Subtitle>Pray, identify thyself to parley with the Oracle.</Subtitle>

        <BardImageContainer>
          {/* Make sure shakespeare.png is in /public */}
          <Image
            src="/shakespeare.png"
            alt="Portrait of William Shakespeare"
            width={120}
            height={120}
            priority
          />
        </BardImageContainer>

        <Quote>
          &quot;Double, double toil and trouble; Fire burn and caldron bubble.&quot;
          <cite>— Macbeth, Act IV, Scene 1</cite>
        </Quote>

        <AuthWrapper>
          <Auth
            supabaseClient={supabase}
            appearance={{
                theme: ThemeSupa,
                // Optional: Apply custom theme variables using CSS variables
                // See Supabase UI docs for more customization options
            }}
            providers={[]} // e.g., ['google', 'github']
            theme="dark" // Or "light"
            showLinks={true} // Show Sign Up / Forgot Password
          />
        </AuthWrapper>

        <Quote>
         &quot;Is this a dagger which I see before me, The handle toward my hand?&quot;
         <cite>— Macbeth, Act II, Scene 1</cite>
        </Quote>

      </ContentBox>
    </AuthPageContainer>
  );
}