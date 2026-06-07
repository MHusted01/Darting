export function getDisplayName(firstName: string | null, username: string | null): string {
  if (firstName) return firstName;
  if (username) return `@${username}`;
  return 'Player';
}
