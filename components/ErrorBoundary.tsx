import React, { Component, ComponentType, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';

interface ErrorBoundaryProps {
  screenName: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error, { tags: { screen: this.props.screenName } });
  }

  handleReset = () => {
    this.setState((prev) => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-ds-bg px-6">
          <View className="w-16 h-16 rounded-full bg-ds-red-container items-center justify-center mb-4">
            <TriangleAlert size={28} color="#ba1a1a" />
          </View>
          <Text className="text-lg font-barlow-condensed text-ds-on-surface text-center">
            Something went wrong
          </Text>
          <Text className="text-sm font-barlow text-ds-on-surface-variant text-center mt-1">
            An unexpected error occurred on this screen.
          </Text>
          <Pressable
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            className="bg-ds-red rounded-xl px-6 py-3 mt-5 active:opacity-70"
          >
            <Text className="text-white text-sm font-barlow-semi">Try again</Text>
          </Pressable>
        </View>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

export function withErrorBoundary<P extends object>(
  Wrapped: ComponentType<P>,
  screenName: string
): ComponentType<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary screenName={screenName}>
        <Wrapped {...props} />
      </ErrorBoundary>
    );
  };
}
