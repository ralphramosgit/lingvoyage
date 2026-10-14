import { router } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';

import { AuthScaffold } from '@/components/AuthScaffold';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { friendlyAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import { validateEmail, validatePassword } from '@/lib/validation';
import { colors, spacing } from '@/theme/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const errors = {
    email: submitted ? validateEmail(email) : null,
    password: submitted ? validatePassword(password) : null,
  };

  const submit = async () => {
    setSubmitted(true);
    setFormError(null);
    if (validateEmail(email) || validatePassword(password)) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // AuthProvider loads the profile and the router takes over from here.
    } catch (error) {
      setFormError(friendlyAuthError(error));
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Log in to keep practicing."
      footer={
        <PressableScale
          onPress={() => router.replace('/sign-up')}
          accessibilityRole="link"
          accessibilityLabel="New to Naviglot? Create an account"
          style={styles.switchLink}>
          <Text variant="body" color={colors.inkMuted}>
            New to Naviglot?{' '}
            <Text variant="bodyStrong" color={colors.sky700}>
              Create an account
            </Text>
          </Text>
        </PressableScale>
      }>
      <TextField
        label="Email"
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon={Lock}
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        error={errors.password}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        right={
          <IconButton
            icon={showPassword ? EyeOff : Eye}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((value) => !value)}
          />
        }
      />
      {formError ? <FormMessage message={formError} /> : null}
      <Button label="Log in" onPress={submit} loading={loading} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  switchLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
