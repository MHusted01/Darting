import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Skeleton from '@/components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders with the default skeleton testID', () => {
    render(<Skeleton className="h-4 w-24" />);
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('accepts a custom testID', () => {
    render(<Skeleton className="h-4 w-24" testID="avatar-skeleton" />);
    expect(screen.getByTestId('avatar-skeleton')).toBeTruthy();
  });

  it('renders statically when reduced motion is enabled', () => {
    const reanimated = jest.requireMock('react-native-reanimated') as {
      useReducedMotion: () => boolean;
    };
    const original = reanimated.useReducedMotion;
    reanimated.useReducedMotion = () => true;
    try {
      render(<Skeleton className="h-4 w-24" />);
      expect(screen.getByTestId('skeleton')).toBeTruthy();
    } finally {
      reanimated.useReducedMotion = original;
    }
  });

  it('is not an accessibility stop as a decorative element', () => {
    render(<Skeleton className="h-4 w-24" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton.props.accessible).toBe(false);
  });

  it('renders multiple skeletons independently', () => {
    render(
      <>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </>
    );
    expect(screen.getAllByTestId('skeleton')).toHaveLength(2);
  });
});
