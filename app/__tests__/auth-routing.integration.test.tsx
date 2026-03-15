import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Index from '@/app/index';
import ProtectedLayout from '@/app/(protected)/_layout';

const mockUseAuth = jest.fn();

jest.mock('@clerk/expo', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return React.createElement(Text, null, `redirect:${href}`);
  },
  Stack: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return React.createElement(Text, null, 'stack-rendered');
  },
}));

describe('Auth Route Integration', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('redirects index to sign-in when signed out', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    render(<Index />);

    expect(screen.getByText('redirect:/(public)/sign-in')).toBeTruthy();
  });

  it('redirects index to protected tabs when signed in', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    render(<Index />);

    expect(screen.getByText('redirect:/(protected)/(tabs)')).toBeTruthy();
  });

  it('renders null for index while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

    const { toJSON } = render(<Index />);

    expect(toJSON()).toBeNull();
  });

  it('redirects protected layout to sign-in when signed out', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    render(<ProtectedLayout />);

    expect(screen.getByText('redirect:/(public)/sign-in')).toBeTruthy();
  });

  it('renders protected stack when signed in', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    render(<ProtectedLayout />);

    expect(screen.getByText('stack-rendered')).toBeTruthy();
  });

  it('renders null for protected layout while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

    const { toJSON } = render(<ProtectedLayout />);

    expect(toJSON()).toBeNull();
  });
});
