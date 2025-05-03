// app/chat/page.tsx
'use client';

import Chat from '../components/Chat'; // Assuming components is inside app/
import Link from 'next/link';
import styled from 'styled-components';
import LogoutButton from '../components/LogoutButton'; // Import LogoutButton

// --- Styled Components ---
const PageContainer = styled.main`
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: ${props => props.theme?.colors?.background || 'var(--background)'};
  background-image: url('/parchment-bg.png'); // Ensure this image is in /public
  background-size: cover;
  background-attachment: fixed;
  position: relative; // Needed for absolute positioning of buttons
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 800px;
  position: relative;
  margin: 2rem auto;
  padding-top: 3rem; // Add padding to avoid overlap with top buttons
`;

// Container for top-left buttons (like Logout)
const TopLeftContainer = styled.div`
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 10;
  display: flex;
  gap: 1rem;
`;

// Container for top-right buttons (like Admin Link)
const TopRightContainer = styled.div`
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10;
`;

// Admin Link styling (adapted from previous AdminButtonLink)
const AdminLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1rem;
  background-color: ${props => props.theme?.colors?.backgroundDark || '#e8dfc2'};
  color: ${props => props.theme?.colors?.primary || '#3a1e1c'};
  font-family: ${props => props.theme?.fonts?.heading || 'inherit'};
  font-weight: 500;
  font-size: 0.9rem;
  border: 1px solid ${props => props.theme?.colors?.border || '#59321f'};
  border-radius: ${props => props.theme?.borderRadius?.medium || '8px'};
  text-decoration: none;
  box-shadow: ${props => props.theme?.shadows?.small || '0 2px 4px rgba(0, 0, 0, 0.1)'};
  transition: all 0.2s ease;

  &:before {
    content: '✒️'; // Scribe icon
    margin-right: 0.5rem;
    font-size: 1.2rem;
  }

  &:hover {
    background-color: ${props => props.theme?.colors?.gold || '#c4a747'};
    border-color: ${props => props.theme?.colors?.primaryDark || '#2a1615'};
    color: ${props => props.theme?.colors?.primaryDark || '#2a1615'};
    box-shadow: ${props => props.theme?.shadows?.medium || '0 4px 8px rgba(0, 0, 0, 0.2)'};
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: ${props => props.theme?.shadows?.small || '0 2px 4px rgba(0, 0, 0, 0.1)'};
  }
`;


const Title = styled.h1`
  text-align: center;
  font-size: 3rem;
  margin-bottom: 0.5rem;
  font-family: ${props => props.theme?.fonts?.heading || 'inherit'};
  color: ${props => props.theme?.colors?.primary || 'var(--foreground)'};
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);

  &:before, &:after {
    content: '✧';
    font-size: 2rem;
    margin: 0 1rem;
    color: ${props => props.theme?.colors?.gold || '#c4a747'};
    vertical-align: middle;
  }
`;

const Subtitle = styled.h2`
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 2rem;
  font-family: ${props => props.theme?.fonts?.heading || 'inherit'};
  font-style: italic;
  color: ${props => props.theme?.colors?.textLight || 'var(--foreground)'};

  &:before, &:after {
    content: '~';
    margin: 0 0.5rem;
    color: ${props => props.theme?.colors?.secondary || 'var(--primary)'};
  }
`;

const Flourish = styled.div`
  text-align: center;
  margin: 1rem 0;
  font-size: 1.5rem;
  color: ${props => props.theme?.colors?.gold || '#c4a747'};
`;
// --- End Styled Components ---

// This is the Chat Page component, shown after login
export default function ChatPage() {
  return (
    <PageContainer>
       {/* Top-Left Buttons */}
       <TopLeftContainer>
           <LogoutButton />
           {/* Add other buttons here if needed */}
       </TopLeftContainer>

       {/* Top-Right Buttons */}
       <TopRightContainer>
           <AdminLink href="/admin">Scribe&apos;s Chambers</AdminLink>
       </TopRightContainer>


      <ContentWrapper>
        <Title>The Macbeth Oracle</Title>
        <Subtitle>A Digital Companion for the Scottish Play</Subtitle>

        <Flourish>❦ ❦ ❦</Flourish>

        {/* The main Chat interface component */}
        <Chat />

        <Flourish>❦ ❦ ❦</Flourish>
      </ContentWrapper>
    </PageContainer>
  );
}