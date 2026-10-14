const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD_LENGTH = 6;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your email.';
  if (!EMAIL_RE.test(value)) return 'Enter a valid email, like name@example.com.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Tell us what to call you.';
  return null;
}
