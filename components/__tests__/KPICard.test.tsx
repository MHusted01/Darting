import React from 'react';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import KPICard from '@/components/KPICard';

describe('KPICard', () => {
  it('renders the label', () => {
    render(<KPICard label="3-Dart Avg" value="60.5" />);
    expect(screen.getByText('3-Dart Avg')).toBeTruthy();
  });

  it('renders the value as a string', () => {
    render(<KPICard label="Bust Rate" value="12%" />);
    expect(screen.getByText('12%')).toBeTruthy();
  });

  it('renders the value as a number', () => {
    render(<KPICard label="180s" value={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<KPICard label="Checkout %" value="45%" subtitle="From 20 attempts" />);
    expect(screen.getByText('From 20 attempts')).toBeTruthy();
  });

  it('does not render subtitle when omitted', () => {
    render(<KPICard label="MPR" value="3.2" />);
    expect(screen.queryByTestId('kpi-card-subtitle')).toBeNull();
  });
});
