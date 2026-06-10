import { useSignUp } from '@clerk/expo';
import { DS_COLORS } from '@/constants/colors';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import OtpInput from '@/components/OtpInput';
import SsoButtons from '@/components/SsoButtons';
import { getErrorMessage } from '@/lib/errors';
import { isValidUsername } from '@/lib/validation';

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const busy = fetchStatus === 'fetching' || isSubmitting;
  const verifyingBusy = fetchStatus === 'fetching' || isVerifying;

  const onSignUp = async () => {
    if (busy) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast) {
      Alert.alert('Error', 'Please enter your first and last name.');
      return;
    }
    const trimmedUsername = username.trim();
    if (!isValidUsername(trimmedUsername)) {
      Alert.alert('Error', 'Username must be 3–20 characters: letters, numbers, or underscores.');
      return;
    }
    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter a password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signUp.password({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        username: trimmedUsername,
        emailAddress: trimmedEmail,
        password,
      });

      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      if (signUp.status === 'complete') {
        const { error: finalizeError } = await signUp.finalize({
          navigate: () => {
            router.replace('/(protected)/(tabs)');
          },
        });
        if (finalizeError) {
          Alert.alert('Error', getErrorMessage(finalizeError));
          return;
        }
        return;
      }

      const { error: verificationError } = await signUp.verifications.sendEmailCode();
      if (verificationError) {
        Alert.alert('Error', getErrorMessage(verificationError));
        return;
      }
      setPendingVerification(true);
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerify = async (code: string) => {
    if (verifyingBusy) return;
    setIsVerifying(true);

    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      if (signUp.status === 'complete') {
        const { error: finalizeError } = await signUp.finalize({
          navigate: () => {
            router.replace('/(protected)/(tabs)');
          },
        });
        if (finalizeError) {
          Alert.alert('Error', getErrorMessage(finalizeError));
          return;
        }
      } else {
        const missing = signUp.missingFields?.join(', ');
        Alert.alert(
          'Verification incomplete',
          missing ? `Missing fields: ${missing}` : 'Please try again.',
        );
      }
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setIsVerifying(false);
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ds-bg">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View className="flex-1 px-6 pt-8 pb-6 justify-center">
          <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface mb-2">Verify Email</Text>
          <Text className="text-base font-barlow text-ds-on-surface-variant mb-8">
            We sent a verification code to {email}
          </Text>

          <View className={verifyingBusy ? 'opacity-50' : ''} pointerEvents={verifyingBusy ? 'none' : 'auto'}>
            <OtpInput onComplete={onVerify} />
          </View>

          {verifyingBusy ? (
            <Text className="mt-6 text-center font-barlow text-ds-on-surface-variant">Verifying...</Text>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => setPendingVerification(false)} className="active:opacity-70">
              <Text className="mt-6 text-center font-barlow text-ds-on-surface-variant">Go back</Text>
            </Pressable>
          )}
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ds-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="flex-1 px-6 pt-6 pb-6">
          <View className="flex-row items-center gap-3 mb-8">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              className="active:opacity-70"
            >
              <ArrowLeft size={22} color={DS_COLORS.onSurface} />
            </Pressable>
            <Text className="text-2xl font-barlow-condensed text-ds-on-surface">Create Account</Text>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">First Name</Text>
              <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
                <TextInput
                  className="py-4 text-base font-barlow text-ds-on-surface"
                  style={{ lineHeight: 22 }}
                  placeholder="John"
                  placeholderTextColor={DS_COLORS.outline}
                  value={firstName}
                  onChangeText={setFirstName}
                  accessibilityLabel="First name"
                  autoComplete="given-name"
                />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">Last Name</Text>
              <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
                <TextInput
                  className="py-4 text-base font-barlow text-ds-on-surface"
                  style={{ lineHeight: 22 }}
                  placeholder="Doe"
                  placeholderTextColor={DS_COLORS.outline}
                  value={lastName}
                  onChangeText={setLastName}
                  accessibilityLabel="Last name"
                  autoComplete="family-name"
                />
              </View>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">Username</Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                className="py-4 text-base font-barlow text-ds-on-surface"
                style={{ lineHeight: 22 }}
                placeholder="dartking99"
                placeholderTextColor={DS_COLORS.outline}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Username"
                autoComplete="username"
              />
            </View>
            <Text className="text-xs font-barlow text-ds-on-surface-variant mt-1.5">
              3–20 characters: letters, numbers, or underscores.
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">Email</Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4">
              <TextInput
                className="py-4 text-base font-barlow text-ds-on-surface"
                style={{ lineHeight: 22 }}
                placeholder="john.doe@example.com"
                placeholderTextColor={DS_COLORS.outline}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                accessibilityLabel="Email address"
                autoComplete="email"
              />
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">Password</Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl flex-row items-center px-4">
              <TextInput
                className="flex-1 py-4 text-base font-barlow text-ds-on-surface"
                style={{ lineHeight: 22 }}
                placeholder="••••••••"
                placeholderTextColor={DS_COLORS.outline}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                accessibilityLabel="Password"
                autoComplete="new-password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                className="active:opacity-70 pl-2"
              >
                {showPassword
                  ? <EyeOff size={18} color={DS_COLORS.outline} />
                  : <Eye size={18} color={DS_COLORS.outline} />
                }
              </Pressable>
            </View>
            <Text className="text-xs font-barlow text-ds-on-surface-variant mt-1.5">
              Must be at least 8 characters.
            </Text>
          </View>

          <Pressable
            testID="sign-up-button"
            accessibilityRole="button"
            accessibilityLabel="Create Account"
            className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${busy ? 'opacity-50' : ''}`}
            onPress={onSignUp}
            disabled={busy}
          >
            <Text className="text-ds-on-red text-base font-barlow-semi">
              {busy ? 'Creating Account...' : 'Create Account'}
            </Text>
          </Pressable>

          <SsoButtons signUpMode />

          <View className="mt-6 items-center">
            <Link href="/(public)/sign-in" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Log in" className="active:opacity-70">
                <Text className="text-base font-barlow text-ds-on-surface-variant">
                  Already have an account?{' '}
                  <Text className="font-barlow-semi text-ds-on-surface">Login</Text>
                </Text>
              </Pressable>
            </Link>
          </View>

          <Text className="text-xs font-barlow text-ds-on-surface-variant text-center mt-4">
            By creating an account, you agree to our{' '}
            <Text className="underline">Terms of Service</Text>
            {' '}and{' '}
            <Text className="underline">Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
