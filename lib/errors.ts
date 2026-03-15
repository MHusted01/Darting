/**
 * Derive a user-facing error message from unknown error shapes.
 *
 * Supports Clerk-style error objects (`errors[]`) and generic `message` errors.
 *
 * @param error - Unknown error value
 * @returns A human-readable message, or a generic fallback
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const withErrors = error as { errors?: { longMessage?: string; message?: string }[] };
    const firstError = withErrors.errors?.[0];
    if (firstError?.longMessage) return firstError.longMessage;
    if (firstError?.message) return firstError.message;

    const withMessage = error as { message?: string };
    if (withMessage.message) return withMessage.message;
  }

  return 'Something went wrong';
}
