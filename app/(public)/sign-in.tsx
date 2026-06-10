import { useSignIn } from '@clerk/expo';
import { DS_COLORS } from '@/constants/colors';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import OtpInput from '@/components/OtpInput';
import SsoButtons from '@/components/SsoButtons';
import { getErrorMessage } from '@/lib/errors';

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { signIn, fetchStatus } = useSignIn();
   
  const si = signIn as any;
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const busy = isSubmitting || fetchStatus === 'fetching';
  const verifyingBusy = isVerifying || fetchStatus === 'fetching';

  const finalize = async () => {
    const { error } = await signIn.finalize({
      navigate: () => {
        router.replace('/(protected)/(tabs)');
      },
    });
    if (error) {
      Alert.alert('Error', getErrorMessage(error));
    }
  };

  const onSignIn = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn.password({
        identifier: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      if (signIn.status === 'complete') {
        await finalize();
        return;
      }

      if (signIn.status === 'needs_client_trust') {
        const emailFactor = signIn.supportedFirstFactors?.find(
          (f) => f.strategy === 'email_code',
        );
        if (emailFactor && 'emailAddressId' in emailFactor) {
          await si.sendEmailCode({ emailAddressId: emailFactor.emailAddressId });
        }
        setPendingVerification(true);
        return;
      }

      Alert.alert('Sign in incomplete', 'Please complete additional verification to continue.');
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
      const { error } = await si.verifyEmailCode({ code });

      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      if (signIn.status === 'complete') {
        await finalize();
      } else {
        Alert.alert('Error', 'Verification incomplete. Please try again.');
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
          <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface mb-2">Verify Device</Text>
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
      <View className="flex-1 px-6 pt-8 pb-6">
        <Text className="text-center text-base font-barlow-semi text-ds-on-surface tracking-widest uppercase mb-12">
          Darting
        </Text>

        <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface mb-1">Welcome Back</Text>
        <Text className="text-base font-barlow text-ds-on-surface-variant mb-8">
          Sign in to track your throws and join the competition.
        </Text>

        <View className="mb-4">
          <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">Email Address</Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl flex-row items-center px-4">
            <Mail size={18} color={DS_COLORS.outline} />
            <TextInput
              className="flex-1 py-4 pl-3 text-base font-barlow text-ds-on-surface"
              style={{ lineHeight: 22 }}
              placeholder="player@example.com"
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
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-barlow-semi text-ds-on-surface">Password</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              className="active:opacity-70"
              onPress={() => router.push('/(public)/reset-password')}
            >
              <Text className="text-sm font-barlow-semi text-ds-red">Forgot Password?</Text>
            </Pressable>
          </View>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl flex-row items-center px-4">
            <Lock size={18} color={DS_COLORS.outline} />
            <TextInput
              className="flex-1 py-4 pl-3 text-base font-barlow text-ds-on-surface"
              style={{ lineHeight: 22 }}
              placeholder="••••••••"
              placeholderTextColor={DS_COLORS.outline}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel="Password"
              autoComplete="current-password"
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
        </View>

        <Pressable
          testID="sign-in-button"
          accessibilityRole="button"
          accessibilityLabel="Login"
          className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${busy ? 'opacity-50' : ''}`}
          onPress={onSignIn}
          disabled={busy}
        >
          <Text className="text-ds-on-red text-base font-barlow-semi">
            {busy ? 'Signing In...' : 'Login'}
          </Text>
        </Pressable>

        <SsoButtons />

        <View className="flex-1" />

        <Link href="/(public)/sign-up" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign up" className="items-center active:opacity-70">
            <Text className="text-base font-barlow text-ds-on-surface-variant">
              Don{'\''}t have an account?{' '}
              <Text className="text-ds-red font-barlow-semi">Sign Up</Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
