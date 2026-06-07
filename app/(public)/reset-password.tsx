import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, Pressable, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import OtpInput from '@/components/OtpInput';
import { getErrorMessage } from '@/lib/errors';

type Step = 'email' | 'otp' | 'password';

export default function ResetPassword() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = isSubmitting || fetchStatus === 'fetching';

  const onSendCode = async () => {
    if (busy) return;
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: createError } = await signIn.create({ identifier: email.trim() });
      if (createError) {
        Alert.alert('Error', getErrorMessage(createError));
        return;
      }

      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      setStep('otp');
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifyCode = async (code: string) => {
    if (busy) return;
    setIsSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });

      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      if (signIn.status === 'needs_new_password') {
        setStep('password');
      } else {
        Alert.alert('Error', 'Verification incomplete. Please try again.');
      }
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async () => {
    if (busy) return;
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });

      if (error) {
        Alert.alert('Error', getErrorMessage(error));
        return;
      }

      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize({
          navigate: () => router.replace('/(protected)/(tabs)'),
        });
        if (finalizeError) {
          Alert.alert('Error', getErrorMessage(finalizeError));
        }
      } else {
        Alert.alert('Error', 'Password reset incomplete. Please try again.');
      }
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'otp') {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ds-bg">
        <View className="flex-1 px-6 pt-8 pb-6 justify-center">
          <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface mb-2">
            Check Your Email
          </Text>
          <Text className="text-base font-barlow text-ds-on-surface-variant mb-8">
            We sent a reset code to {email}
          </Text>

          <View className={busy ? 'opacity-50' : ''} pointerEvents={busy ? 'none' : 'auto'}>
            <OtpInput onComplete={onVerifyCode} />
          </View>

          {busy ? (
            <Text className="mt-6 text-center font-barlow text-ds-on-surface-variant">
              Verifying...
            </Text>
          ) : (
            <Pressable onPress={() => setStep('email')} className="active:opacity-70">
              <Text className="mt-6 text-center font-barlow text-ds-on-surface-variant">
                Go back
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'password') {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ds-bg">
        <View className="flex-1 px-6 pt-8 pb-6">
          <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface mb-2">
            New Password
          </Text>
          <Text className="text-base font-barlow text-ds-on-surface-variant mb-8">
            Choose a strong password for your account.
          </Text>

          <View className="mb-6">
            <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">
              New Password
            </Text>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl flex-row items-center px-4">
              <Lock size={18} color="#747878" />
              <TextInput
                className="flex-1 py-4 pl-3 text-base font-barlow text-ds-on-surface"
                style={{ lineHeight: 22 }}
                placeholder="New password"
                placeholderTextColor="#747878"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                accessibilityLabel="New password"
                autoComplete="new-password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                className="active:opacity-70 pl-2"
              >
                {showPassword ? (
                  <EyeOff size={18} color="#747878" />
                ) : (
                  <Eye size={18} color="#747878" />
                )}
              </Pressable>
            </View>
          </View>

          <Pressable
            testID="reset-submit-button"
            accessibilityRole="button"
            accessibilityLabel="Set new password"
            className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${busy ? 'opacity-50' : ''}`}
            onPress={onResetPassword}
            disabled={busy}
          >
            <Text className="text-white text-base font-barlow-semi">
              {busy ? 'Resetting...' : 'Reset Password'}
            </Text>
          </Pressable>

          {!busy && (
            <Pressable onPress={() => setStep('otp')} className="active:opacity-70">
              <Text className="mt-6 text-center font-barlow text-ds-on-surface-variant">
                Go back
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ds-bg">
      <View className="flex-1 px-6 pt-8 pb-6">
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Go back"
          onPress={() => router.back()}
          className="active:opacity-70 self-start mb-8"
        >
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>

        <Text className="text-3xl font-barlow-condensed-xbold text-ds-on-surface mb-2">
          Forgot Password?
        </Text>
        <Text className="text-base font-barlow text-ds-on-surface-variant mb-8">
          Enter your email and we&apos;ll send you a reset code.
        </Text>

        <View className="mb-6">
          <Text className="text-sm font-barlow-semi text-ds-on-surface mb-1.5">
            Email Address
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl flex-row items-center px-4">
            <Mail size={18} color="#747878" />
            <TextInput
              className="flex-1 py-4 pl-3 text-base font-barlow text-ds-on-surface"
              style={{ lineHeight: 22 }}
              placeholder="player@example.com"
              placeholderTextColor="#747878"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Email address"
              autoComplete="email"
            />
          </View>
        </View>

        <Pressable
          testID="reset-send-button"
          accessibilityRole="button"
          accessibilityLabel="Send reset code"
          className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${busy ? 'opacity-50' : ''}`}
          onPress={onSendCode}
          disabled={busy}
        >
          <Text className="text-white text-base font-barlow-semi">
            {busy ? 'Sending...' : 'Send Reset Code'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
