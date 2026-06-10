import React from 'react';
import { Text } from 'react-native';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AnimatedPressable from '@/components/ui/AnimatedPressable';

jest.mock('@/lib/haptics', () => ({
  impact: jest.fn(),
  notify: jest.fn(),
  selection: jest.fn(),
}));

const haptics = jest.requireMock('@/lib/haptics') as {
  impact: jest.Mock;
  notify: jest.Mock;
  selection: jest.Mock;
};

describe('AnimatedPressable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children and fires onPress', () => {
    const onPress = jest.fn();
    render(
      <AnimatedPressable onPress={onPress} accessibilityLabel="Do thing">
        <Text>Tap me</Text>
      </AnimatedPressable>
    );
    fireEvent.press(screen.getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not trigger haptics when no haptic prop is set', () => {
    render(
      <AnimatedPressable onPress={jest.fn()} accessibilityLabel="Plain">
        <Text>Plain</Text>
      </AnimatedPressable>
    );
    fireEvent.press(screen.getByText('Plain'));
    expect(haptics.impact).not.toHaveBeenCalled();
    expect(haptics.notify).not.toHaveBeenCalled();
    expect(haptics.selection).not.toHaveBeenCalled();
  });

  it('triggers impact haptic for impact styles', () => {
    render(
      <AnimatedPressable onPress={jest.fn()} haptic="medium" accessibilityLabel="Impact">
        <Text>Impact</Text>
      </AnimatedPressable>
    );
    fireEvent.press(screen.getByText('Impact'));
    expect(haptics.impact).toHaveBeenCalledWith('medium');
  });

  it('triggers success notification haptic', () => {
    render(
      <AnimatedPressable onPress={jest.fn()} haptic="success" accessibilityLabel="Success">
        <Text>Success</Text>
      </AnimatedPressable>
    );
    fireEvent.press(screen.getByText('Success'));
    expect(haptics.notify).toHaveBeenCalledWith('success');
  });

  it('triggers selection haptic', () => {
    render(
      <AnimatedPressable onPress={jest.fn()} haptic="selection" accessibilityLabel="Select">
        <Text>Select</Text>
      </AnimatedPressable>
    );
    fireEvent.press(screen.getByText('Select'));
    expect(haptics.selection).toHaveBeenCalled();
  });

  it('forwards accessibility props', () => {
    render(
      <AnimatedPressable onPress={jest.fn()} accessibilityLabel="Submit score">
        <Text>Submit</Text>
      </AnimatedPressable>
    );
    expect(screen.getByLabelText('Submit score')).toBeTruthy();
  });

  it('does not fire onPress or haptics when disabled', () => {
    const onPress = jest.fn();
    render(
      <AnimatedPressable onPress={onPress} haptic="light" disabled accessibilityLabel="Disabled">
        <Text>Disabled</Text>
      </AnimatedPressable>
    );
    fireEvent.press(screen.getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
    expect(haptics.impact).not.toHaveBeenCalled();
  });
});
