import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import HelpCenterScreen from '@/app/(protected)/help-center';

const mockBack: jest.Mock<any> = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe('Help Center Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Help Center heading', () => {
    render(<HelpCenterScreen />);
    expect(screen.getByText('Help Center')).toBeTruthy();
  });

  it('back button calls router.back()', () => {
    render(<HelpCenterScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders all four FAQ question headers', () => {
    render(<HelpCenterScreen />);
    expect(screen.getByText('How do I add friends?')).toBeTruthy();
    expect(screen.getByText('How do clubs work?')).toBeTruthy();
    expect(screen.getByText('How does scoring work?')).toBeTruthy();
    expect(screen.getByText('How do I change my password?')).toBeTruthy();
  });

  it('answers are hidden by default', () => {
    render(<HelpCenterScreen />);
    expect(screen.queryByText(/tap.*Find/i)).toBeNull();
  });

  it('tapping a question reveals its answer', () => {
    render(<HelpCenterScreen />);
    fireEvent.press(screen.getByText('How do I add friends?'));
    expect(screen.getByText(/Search by name/i)).toBeTruthy();
  });

  it('tapping an open question collapses its answer', () => {
    render(<HelpCenterScreen />);
    fireEvent.press(screen.getByText('How do I add friends?'));
    fireEvent.press(screen.getByText('How do I add friends?'));
    expect(screen.queryByText(/Search by name/i)).toBeNull();
  });
});
