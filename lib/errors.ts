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
    const withErrors = error as { errors?: unknown };
    if (Array.isArray(withErrors.errors)) {
      const firstError = withErrors.errors[0];
      if (typeof firstError === 'object' && firstError !== null) {
        const normalizedError = firstError as { longMessage?: unknown; message?: unknown };
        if (typeof normalizedError.longMessage === 'string') return normalizedError.longMessage;
        if (typeof normalizedError.message === 'string') return normalizedError.message;
      }
    }

    const withMessage = error as { message?: unknown };
    if (typeof withMessage.message === 'string') return withMessage.message;
  }

  return 'Something went wrong';
}
