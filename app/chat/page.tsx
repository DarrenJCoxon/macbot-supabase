// app/chat/page.tsx
'use client';

import Chat from '../components/Chat';
import Link from 'next/link';
import styled from 'styled-components';
import LogoutButton from '../components/LogoutButton';

// --- Styled Components (Modifications below) ---
const PageContainer = styled.main`
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  /* justify-content: center; // Remove or change to flex-start */
  justify-content: flex-start; // Align content towards the top
  /* padding: 1rem; */
  padding: 1rem 2rem 2rem 2rem; // Reduce top padding, keep others
  background-color: ${props => props.theme?.colors?.background || 'var(--background)'};
  background-image: url('/parchment-bg.png');
  background-size: cover;
  background-attachment: fixed;
  position: relative;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 800px;
  position: relative;
  /* margin: 2rem auto; */
  margin: 1rem auto 2rem auto; // Reduce top margin
  /* padding-top: 1rem; // REMOVE or significantly reduce this */
  padding-top: 0; // Remove internal top padding
`;

// Container for top-left buttons
const TopLeftContainer = styled.div`
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 10;
  display: flex;
  gap: 1rem;
`;

// Container for top-right buttons
const TopRightContainer = styled.div`
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10;
`;

// Admin Link styling
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

  &:before { content: '✒️'; margin-right: 0.5rem; font-size: 1.2rem; }
  &:hover { /* ... existing hover styles ... */ }
  &:active { /* ... existing active styles ... */ }
`;

const Title = styled.h1`
  text-align: center;
  font-size: 2.5rem; // Slightly smaller title
  margin-bottom: 0.5rem; // Keep margin small
  margin-top: 3rem; // Add margin above title since ContentWrapper padding was removed
  font-family: ${props => props.theme?.fonts?.heading || 'inherit'};
  color: ${props => props.theme?.colors?.primary || 'var(--foreground)'};
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);

  &:before, &:after { /* ... existing pseudo-elements ... */ }
`;

const Subtitle = styled.h2`
  text-align: center;
  font-size: 1.3rem; // Slightly smaller subtitle
  /* margin-bottom: 2rem; */
  margin-bottom: 1rem; // Reduce bottom margin
  font-family: ${props => props.theme?.fonts?.heading || 'inherit'};
  font-style: italic;
  color: ${props => props.theme?.colors?.textLight || 'var(--foreground)'};

  &:before, &:after { /* ... existing pseudo-elements ... */ }
`;

const Flourish = styled.div`
  text-align: center;
  /* margin: 1rem 0; */
  margin: 0.5rem 0; // Reduce vertical margin
  font-size: 1.5rem;
  color: ${props => props.theme?.colors?.gold || '#c4a747'};
`;
// --- End Styled Components ---


export default function ChatPage() {
  return (
    <PageContainer>
       <TopLeftContainer>
           <LogoutButton />
       </TopLeftContainer>
       <TopRightContainer>
           <AdminLink href="/admin">Scribe&apos;s Chambers</AdminLink>
       </TopRightContainer>

      <ContentWrapper>
        <Title>The Macbeth Oracle</Title>
        <Subtitle>A Digital Companion for the Scottish Play</Subtitle>
        <Flourish>❦ ❦ ❦</Flourish>
        <Chat /> {/* This component has its own height (600px) */}
        {/* Removed bottom flourish to save space */}
        {/* <Flourish>❦ ❦ ❦</Flourish> */}
      </ContentWrapper>
    </PageContainer>
  );
}