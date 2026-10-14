// Expo inlines EXPO_PUBLIC_ variables at build time, but only when they are written as
// literal `process.env.EXPO_PUBLIC_...` expressions. Keep them that way.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const API_URL = process.env.EXPO_PUBLIC_API_URL;

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing ${name}. Copy mobile/.env.example to mobile/.env, fill it in (docs/setup/05), ` +
        'then restart Expo with "npx expo start -c".',
    );
  }
  return trimmed;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', SUPABASE_URL).replace(/\/+$/, ''),
  supabasePublishableKey: required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', SUPABASE_PUBLISHABLE_KEY),
  apiUrl: required('EXPO_PUBLIC_API_URL', API_URL).replace(/\/+$/, ''),
} as const;
