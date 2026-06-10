import React from 'react';
import { Text } from 'react-native';
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ErrorBoundary, { withErrorBoundary } from '@/components/ErrorBoundary';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

const Sentry = jest.requireMock('@sentry/react-native') as { captureException: jest.Mock };

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom');
  }
  return <Text>All good</Text>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary screenName="test">
        <Text>Healthy child</Text>
      </ErrorBoundary>
    );
    expect(screen.getByText('Healthy child')).toBeTruthy();
  });

  it('shows fallback and reports to Sentry when a child throws', () => {
    render(
      <ErrorBoundary screenName="stats">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { screen: 'stats' } })
    );
  });

  it('recovers via Try again once the child no longer throws', () => {
    const { rerender } = render(
      <ErrorBoundary screenName="test">
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    rerender(
      <ErrorBoundary screenName="test">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    fireEvent.press(screen.getByText('Try again'));
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('withErrorBoundary wraps a component', () => {
    const Wrapped = withErrorBoundary(() => <Text>Wrapped screen</Text>, 'wrapped');
    render(<Wrapped />);
    expect(screen.getByText('Wrapped screen')).toBeTruthy();
  });

  it('withErrorBoundary catches errors from the wrapped component', () => {
    const Wrapped = withErrorBoundary(() => {
      throw new Error('wrapped boom');
    }, 'wrapped');
    render(<Wrapped />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { screen: 'wrapped' } })
    );
  });
});
