import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SegmentHeatmap from '@/components/SegmentHeatmap';
import type { SegmentAccuracy } from '@/lib/stats';

const emptyAccuracy: SegmentAccuracy = {};

const basicAccuracy: SegmentAccuracy = {
  '20': { singles: 6, doubles: 2, triples: 1, throwShare: 0.45 },
  '19': { singles: 4, doubles: 1, triples: 0, throwShare: 0.25 },
  '25': { singles: 2, doubles: 0, triples: 0, throwShare: 0.1 },
};

describe('SegmentHeatmap', () => {
  it('renders all 20 number segments', () => {
    render(<SegmentHeatmap accuracy={emptyAccuracy} />);
    for (let i = 1; i <= 20; i++) {
      expect(screen.getByTestId(`segment-${i}`)).toBeTruthy();
    }
  });

  it('renders the bull cell', () => {
    render(<SegmentHeatmap accuracy={emptyAccuracy} />);
    expect(screen.getByTestId('segment-25')).toBeTruthy();
  });

  it('displays segment numbers as text labels', () => {
    render(<SegmentHeatmap accuracy={emptyAccuracy} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('displays bull label', () => {
    render(<SegmentHeatmap accuracy={emptyAccuracy} />);
    expect(screen.getByText('Bull')).toBeTruthy();
  });

  it('calls onSegmentPress with segment key and stat when a segment is tapped', () => {
    const onPress = jest.fn();
    render(<SegmentHeatmap accuracy={basicAccuracy} onSegmentPress={onPress} />);
    fireEvent.press(screen.getByTestId('segment-20'));
    expect(onPress).toHaveBeenCalledWith('20', basicAccuracy['20']);
  });

  it('calls onSegmentPress with "25" for bull tap', () => {
    const onPress = jest.fn();
    render(<SegmentHeatmap accuracy={basicAccuracy} onSegmentPress={onPress} />);
    fireEvent.press(screen.getByTestId('segment-25'));
    expect(onPress).toHaveBeenCalledWith('25', basicAccuracy['25']);
  });

  it('does not throw when onSegmentPress is omitted', () => {
    render(<SegmentHeatmap accuracy={basicAccuracy} />);
    expect(() => fireEvent.press(screen.getByTestId('segment-1'))).not.toThrow();
  });

  it('renders with empty accuracy without crashing', () => {
    expect(() => render(<SegmentHeatmap accuracy={emptyAccuracy} />)).not.toThrow();
  });
});
