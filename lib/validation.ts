const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(value);
}
