// app/components/LogoutButton.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { createClient } from '../lib/supabase/client'; // Adjust path if needed

// Style the button (you can customize this further)
const StyledButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: ${props => props.theme.colors.backgroundDark};
  color: ${props => props.theme.colors.secondaryDark};
  border: 1px solid ${props => props.theme.colors.secondary};
  border-radius: ${props => props.theme.borderRadius.medium};
  font-family: ${props => props.theme.fonts.heading};
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem; // Space between icon and text

  &:before {
    content: '🚪'; // Simple door/exit icon
    font-size: 1.1rem;
  }

  &:hover:not(:disabled) {
    background-color: ${props => props.theme.colors.secondary};
    color: white;
    border-color: ${props => props.theme.colors.secondaryDark};
    box-shadow: ${props => props.theme.shadows.small};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient(); // Get Supabase client instance
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    console.log('Attempting to log out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      console.log('Logout successful. Redirecting to login...');
      // Redirect to the login page (root) after successful logout
      router.push('/');
      router.refresh(); // Force refresh to clear potentially cached user data
    } catch (error) {
      console.error('Error logging out:', error);
      // Optionally, show an error message to the user
      alert(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StyledButton onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'Leaving...' : 'Sign Out'}
    </StyledButton>
  );
}