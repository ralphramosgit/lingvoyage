import { router } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, MailCheck, User } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';

import { AuthScaffold } from '@/components/AuthScaffold';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { friendlyAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import { validateEmail, validateName, validatePassword } from '@/lib/validation';
import { colors, radii, spacing } from '@/theme/theme';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Inline validation shows after the first submit attempt, then updates as the user types.
  const errors = {
    name: submitted ? validateName(name) : null,
    email: submitted ? validateEmail(email) : null,
    password: submitted ? validatePassword(password) : null,
  };

  const submit = async () => {
    setSubmitted(true);
    setFormError(null);
    if (validateName(name) || validateEmail(email) || validatePassword(password)) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is still on in Supabase: there's no session until they confirm.
        setNeedsConfirmation(true);
        setLoading(false);
      }
      // With a session, AuthProvider loads the profile and the router moves on to Setup.
    } catch (error) {
      setFormError(friendlyAuthError(error));
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <AuthScaffold title="Check your email" subtitle="One more step before you can start practicing.">
        <View style={styles.confirmIcon}>
          <MailCheck size={30} color={colors.sky700} />
        </View>
        <Text variant="body" align="center">
          We sent a confirmation link to{' '}
          <Text variant="bodyStrong">{email.trim()}</Text>. Confirm your email, then log in.
        </Text>
        <Button label="Go to log in" onPress={() => router.replace('/sign-in')} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      title="Create your account"
      subtitle="Start practicing Mandarin for your trip."
      footer={
        <PressableScale
          onPress={() => router.replace('/sign-in')}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Log in"
          style={styles.switchLink}>
          <Text variant="body" color={colors.inkMuted}>
            Already have an account?{' '}
            <Text variant="bodyStrong" color={colors.sky700}>
              Log in
            </Text>
          </Text>
        </PressableScale>
      }>
      <TextField
        label="Name"
        icon={User}
        value={name}
        onChangeText={setName}
        placeholder="What should we call you?"
        error={errors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        placeholder="At least 6 characters"
        error={errors.password}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules="minlength: 6;"
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
      <Button label="Create account" onPress={submit} loading={loading} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  switchLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  confirmIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
