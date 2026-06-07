import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ClubMembersSection } from '@/components/games/ClubMembersSection';
import type { ContactPlayer, ClubMember } from '@/types/social';

const mockUseClubMembers = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('@/hooks/useClubs', () => ({
  useClubMembers: (...args: unknown[]) => mockUseClubMembers(...args),
}));

jest.mock('@clerk/expo', () => ({
  useAuth: () => mockUseAuth(),
}));

function makeMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    id: 'member-1',
    membershipId: 'ms-1',
    firstName: 'Alice',
    lastName: 'Smith',
    username: 'alice',
    avatarUrl: null,
    role: 'member',
    joinedAt: '2026-01-01',
    ...overrides,
  };
}

describe('ClubMembersSection', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ userId: 'current-user' });
  });

  it('renders nothing while data is loading', () => {
    mockUseClubMembers.mockReturnValue({ data: undefined });
    const { toJSON } = render(
      <ClubMembersSection
        clubId="club-1"
        clubName="Red Dragons"
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when all members are the current user', () => {
    mockUseClubMembers.mockReturnValue({ data: [makeMember({ id: 'current-user' })] });
    const { toJSON } = render(
      <ClubMembersSection
        clubId="club-1"
        clubName="Red Dragons"
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders member chips excluding current user', () => {
    mockUseClubMembers.mockReturnValue({
      data: [
        makeMember({ id: 'current-user', firstName: 'Me' }),
        makeMember({ id: 'member-2', firstName: 'Bob', membershipId: 'ms-2' }),
      ],
    });
    render(
      <ClubMembersSection
        clubId="club-1"
        clubName="Red Dragons"
        addedContactUserIds={new Set()}
        onAdd={jest.fn() as (c: ContactPlayer) => void}
      />,
    );
    expect(screen.queryByText('Me')).toBeNull();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('calls onAdd with correct ContactPlayer when chip is pressed', () => {
    mockUseClubMembers.mockReturnValue({
      data: [makeMember({ id: 'member-2', firstName: 'Bob', username: 'bob99', membershipId: 'ms-2' })],
    });
    const onAdd = jest.fn() as jest.MockedFunction<(c: ContactPlayer) => void>;
    render(
      <ClubMembersSection
        clubId="club-1"
        clubName="Red Dragons"
        addedContactUserIds={new Set()}
        onAdd={onAdd}
      />,
    );
    fireEvent.press(screen.getByLabelText('Add Bob'));
    expect(onAdd).toHaveBeenCalledWith({ userId: 'member-2', displayName: 'Bob', username: 'bob99' });
  });

  it('does not call onAdd when member is already added', () => {
    mockUseClubMembers.mockReturnValue({
      data: [makeMember({ id: 'member-2', firstName: 'Bob', membershipId: 'ms-2' })],
    });
    const onAdd = jest.fn() as jest.MockedFunction<(c: ContactPlayer) => void>;
    render(
      <ClubMembersSection
        clubId="club-1"
        clubName="Red Dragons"
        addedContactUserIds={new Set(['member-2'])}
        onAdd={onAdd}
      />,
    );
    fireEvent.press(screen.getByLabelText('Add Bob'));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
