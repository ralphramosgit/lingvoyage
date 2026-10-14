import type { Session, User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useRef, useState } from 'react';

import type { Profile } from '@/types/database';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until the first session + profile check finishes. */
  loading: boolean;
  /** Set when there's a session but the profile couldn't be loaded (e.g. offline). */
  profileError: string | null;
};

type AuthContextValue = AuthState & {
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}

/** Loads the user's profile row, creating it if the sign-up trigger didn't run. */
async function loadProfile(user: User): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const metadataName: unknown = user.user_metadata?.display_name;
  const { data: created, error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: typeof metadataName === 'string' ? metadataName : null })
    .select('*')
    .single();
  if (upsertError) throw upsertError;
  return created;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    loading: true,
    profileError: null,
  });
  // Each apply() gets a ticket; only the latest one may write state.
  const ticket = useRef(0);
  const profileRef = useRef<Profile | null>(null);

  const apply = useCallback(async (session: Session | null) => {
    const myTicket = ++ticket.current;
    if (!session) {
      profileRef.current = null;
      setState({ session: null, profile: null, loading: false, profileError: null });
      return;
    }
    try {
      const profile = await loadProfile(session.user);
      if (myTicket !== ticket.current) return;
      profileRef.current = profile;
      // Session and profile land together, so the router never sees a session without its profile.
      setState({ session, profile, loading: false, profileError: null });
    } catch (error) {
      if (myTicket !== ticket.current) return;
      const message = error instanceof Error ? error.message : 'Could not load your profile.';
      setState({ session, profile: null, loading: false, profileError: message });
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) void apply(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // handled by getSession above
      const sameUser = session && profileRef.current && session.user.id === profileRef.current.id;
      if (sameUser && event !== 'SIGNED_OUT') {
        // Token refresh or user update: keep the profile, swap the session.
        setState((current) => ({ ...current, session }));
        return;
      }
      // Don't await Supabase calls inside this callback (it can deadlock); defer instead.
      setTimeout(() => {
        if (active) void apply(session);
      }, 0);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [apply]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await apply(data.session);
  }, [apply]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Offline or server error: still clear the session on this device.
      await supabase.auth.signOut({ scope: 'local' });
    }
  }, []);

  return <AuthContext value={{ ...state, refreshProfile, signOut }}>{children}</AuthContext>;
}
