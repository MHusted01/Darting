import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SocialContactPicker } from '@/components/games/SocialContactPicker';
import type { ContactPlayer, Friend, Club } from '@/types/social';

jest.mock('@/components/games/ClubMembersSection', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    ClubMembersSection: ({ clubName }: { clubName: string }) =>
      React.createElement(Text, null, `club:${clubName}`),
  };
});

function makeFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'user-1',
    friendshipId: 'fs-1',
    firstName: 'Alice',
    lastName: 'Smith',
    username: 'alice',
    avatarUrl: null,
    status: 'online',
    threeDartAvg: null,
    ...overrides,
  };
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-1',
    name: 'Red Dragons',
    description: null,
    createdBy: 'user-x',
    role: 'member',
    ...overrides,
  };
}

describe('SocialContactPicker', () => {
  it('renders nothing when friends and clubs are empty', () => {
    render(
      <SocialContactPicker
        friends={[]}
        clubs={[]}
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(screen.queryByText(/from your network/i)).toBeNull();
  });

  it('renders section header when friends are present', () => {
    render(
      <SocialContactPicker
        friends={[makeFriend()]}
        clubs={[]}
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(screen.getByText('From Your Network')).toBeTruthy();
  });

  it('renders a chip for each friend', () => {
    render(
      <SocialContactPicker
        friends={[
          makeFriend({ id: 'u1', firstName: 'Alice', friendshipId: 'fs-1' }),
          makeFriend({ id: 'u2', firstName: 'Bob', friendshipId: 'fs-2' }),
        ]}
        clubs={[]}
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('calls onAdd with correct ContactPlayer when a chip is pressed', () => {
    const onAdd = jest.fn() as jest.MockedFunction<(c: ContactPlayer) => void>;
    render(
      <SocialContactPicker
        friends={[makeFriend({ id: 'user-1', firstName: 'Alice', username: 'alice99' })]}
        clubs={[]}
        addedContactUserIds={new Set()}
        onAdd={onAdd}
      />,
    );
    fireEvent.press(screen.getByLabelText('Add Alice'));
    expect(onAdd).toHaveBeenCalledWith({
      userId: 'user-1',
      displayName: 'Alice',
      username: 'alice99',
    });
  });

  it('does not call onAdd when chip is already added', () => {
    const onAdd = jest.fn() as jest.MockedFunction<(c: ContactPlayer) => void>;
    render(
      <SocialContactPicker
        friends={[makeFriend({ id: 'user-1', firstName: 'Alice' })]}
        clubs={[]}
        addedContactUserIds={new Set(['user-1'])}
        onAdd={onAdd}
      />,
    );
    fireEvent.press(screen.getByLabelText('Add Alice'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('renders section header when only clubs are present', () => {
    render(
      <SocialContactPicker
        friends={[]}
        clubs={[makeClub()]}
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(screen.getByText('From Your Network')).toBeTruthy();
  });

  it('renders ClubMembersSection for each club', () => {
    render(
      <SocialContactPicker
        friends={[]}
        clubs={[makeClub({ name: 'Red Dragons' }), makeClub({ id: 'club-2', name: 'Eagles' })]}
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(screen.getByText('club:Red Dragons')).toBeTruthy();
    expect(screen.getByText('club:Eagles')).toBeTruthy();
  });

  it('uses username as displayName when firstName is null', () => {
    const onAdd = jest.fn() as jest.MockedFunction<(c: ContactPlayer) => void>;
    render(
      <SocialContactPicker
        friends={[makeFriend({ id: 'u1', firstName: null, username: 'dartking' })]}
        clubs={[]}
        addedContactUserIds={new Set()}
        onAdd={onAdd}
      />,
    );
    fireEvent.press(screen.getByLabelText('Add @dartking'));
    expect(onAdd).toHaveBeenCalledWith({
      userId: 'u1',
      displayName: '@dartking',
      username: 'dartking',
    });
  });
});
