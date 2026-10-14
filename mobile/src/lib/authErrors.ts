import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/** Turns a Supabase auth error into a sentence a traveler can act on. */
export function friendlyAuthError(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  if (isAuthError(error)) {
    const code = error.code ?? '';
    const message = error.message.toLowerCase();
    if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
      return 'An account with this email already exists. Try logging in instead.';
    }
    if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
      return "That email and password don't match. Check them and try again.";
    }
    if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
      return 'Confirm your email first (check your inbox), then log in.';
    }
    if (code === 'weak_password') {
      return 'Choose a stronger password (at least 6 characters).';
    }
    if (code === 'email_address_invalid' || code === 'validation_failed') {
      return 'That email address doesn’t look right. Check it and try again.';
    }
    if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error.status === 429) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (code === 'signup_disabled') {
      return 'Sign-ups are turned off for this project right now.';
    }
  }
  if (error instanceof Error && /network|fetch/i.test(error.message)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
