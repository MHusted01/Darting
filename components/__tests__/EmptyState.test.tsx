import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Users } from 'lucide-react-native';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title and message', () => {
    render(
      <EmptyState icon={Users} title="No friends yet" message="Search to add friends." />
    );
    expect(screen.getByText('No friends yet')).toBeTruthy();
    expect(screen.getByText('Search to add friends.')).toBeTruthy();
  });

  it('renders without a message', () => {
    render(<EmptyState icon={Users} title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('renders CTA and fires onCtaPress', () => {
    const onCtaPress = jest.fn();
    render(
      <EmptyState
        icon={Users}
        title="No friends yet"
        ctaLabel="Find friends"
        onCtaPress={onCtaPress}
      />
    );
    fireEvent.press(screen.getByText('Find friends'));
    expect(onCtaPress).toHaveBeenCalledTimes(1);
  });

  it('does not render a CTA when ctaLabel is omitted', () => {
    render(<EmptyState icon={Users} title="No friends yet" />);
    expect(screen.queryByTestId('empty-state-cta')).toBeNull();
  });
});
