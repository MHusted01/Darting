import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DrillCatalogueItem from '@/components/DrillCatalogueItem';

describe('DrillCatalogueItem', () => {
  it('renders the drill name', () => {
    render(
      <DrillCatalogueItem
        name="Double Practice"
        description="Cycle through every double"
        benchmarkTarget="35+ hits (55%+)"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Double Practice')).toBeTruthy();
  });

  it('renders the description', () => {
    render(
      <DrillCatalogueItem
        name="Double Practice"
        description="Cycle through every double"
        benchmarkTarget="35+ hits (55%+)"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Cycle through every double')).toBeTruthy();
  });

  it('renders the benchmark target', () => {
    render(
      <DrillCatalogueItem
        name="Double Practice"
        description="Cycle through every double"
        benchmarkTarget="35+ hits (55%+)"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('35+ hits (55%+)')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <DrillCatalogueItem
        name="Double Practice"
        description="Cycle through every double"
        benchmarkTarget="35+ hits (55%+)"
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByText('Double Practice'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
