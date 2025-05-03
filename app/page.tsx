// app/page.tsx (New Landing/Auth Page)
'use client';

import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Import Image component
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
  background-image: url('/parchment-bg.png');
  background-size: cover;
  font-family: ${props => props.theme.fonts.body};
  color: ${props => props.theme.colors.text};
`;

const ContentBox = styled.div`
  background-color: rgba(248, 244, 233, 0.85); // Semi-transparent parchment
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: 2rem 3rem;
  max-width: 550px;
  width: 100%;
  text-align: center;
  box-shadow: ${props => props.theme.shadows.large};
  backdrop-filter: blur(3px);
`;

const Title = styled.h1`
  font-family: ${props => props.theme.fonts.heading};
  color: ${props => props.theme.colors.primary};
  font-size: 2.8rem;
  margin-bottom: 0.5rem;
  &:before, &:after { content: '📜'; margin: 0 10px; }
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
  max-width: 80%;
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
  // Target Supabase Auth component elements for basic override if needed
  // Example: Changing button colors (use inspect element to find classes)
  // .supabase-auth-ui_ui-button button {
  //   background-color: ${props => props.theme.colors.secondary};
  // }
`;
// --- End Styled Components ---


export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          console.log('AuthPage: User signed in, redirecting to /chat...');
          router.push('/chat'); // Redirect to the NEW chat page
          router.refresh(); // Refresh needed for server components potentially
        }
        // Add SIGNED_OUT listener if you implement logout
        // if (event === 'SIGNED_OUT') {
        //   router.push('/'); // Redirect to login on sign out
        //   router.refresh();
        // }
      }
    );

    // Also check if user is already logged in on initial mount
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('AuthPage: Existing session found, redirecting to /chat...');
        router.push('/chat');
      }
    };
    checkSession();


    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]);


  return (
    <AuthPageContainer>
      <ContentBox>
        <Title>Hark, Traveler!</Title>
        <Subtitle>Pray, identify thyself to parley with the Oracle.</Subtitle>

        <BardImageContainer>
          {/* Add your Shakespeare image here */}
          <Image
            src="/shakespeare.png" // Make sure this image is in /public
            alt="Portrait of William Shakespeare"
            width={120}
            height={120}
            priority // Load image sooner
          />
        </BardImageContainer>

        <Quote>
          &quot;Double, double toil and trouble; Fire burn and cauldron bubble.&quot;
          <cite>— Macbeth, Act IV, Scene 1</cite>
        </Quote>

        <AuthWrapper>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }} // Keep Supa theme for structure
            providers={[]} // Add providers if needed (e.g., ['github', 'google'])
            theme="dark" // Or "light" - match your preference
            showLinks={true} // Show Sign Up / Forgot Password links
            // You can add more customization via appearance prop if needed
            // appearance={{
            //   variables: {
            //     default: {
            //       colors: {
            //         brand: theme.colors.secondary,
            //         brandAccent: theme.colors.secondaryLight,
            //       },
            //     },
            //   },
            // }}
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