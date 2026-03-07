import { useSignUp } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, Pressable, View, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import OtpInput from '@/components/OtpInput';
import SsoButtons from '@/components/SsoButtons';

WebBrowser.maybeCompleteAuthSession();

/**
 * Renders the sign-up screen and manages account creation and email verification with Clerk.
 *
 * Creates a user from first name, last name, email, and password; if the sign-up completes immediately it activates the session and navigates to the protected area, otherwise it initiates an email-code verification flow and displays an OTP input. Errors are surfaced via alerts.
 *
 * @returns The sign-up UI as a React element.
 */
export default function SignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const onSignUp = async () => {
    if (!isLoaded || isSubmitting) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast) {
      Alert.alert('Error', 'Please enter your first and last name.');
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

    setIsSubmitting(true);

    try {
      await signUp.create({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        emailAddress: trimmedEmail,
        password,
      });

      if (signUp.status === 'complete') {
        await setActive({ session: signUp.createdSessionId });
        router.replace('/(protected)/(tabs)');
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerify = async (code: string) => {
    if (!isLoaded || isVerifying) return;
    setIsVerifying(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(protected)/(tabs)');
      } else {
        const missing = signUp.missingFields?.join(', ');
        Alert.alert(
          'Verification incomplete',
          missing ? `Missing fields: ${missing}` : 'Please try again.',
        );
      }
    } catch (err: any) {
      // If email was already verified (e.g. via email link), complete the sign-up
      if (signUp.status === 'complete') {
        await setActive({ session: signUp.createdSessionId });
        router.replace('/(protected)/(tabs)');
        return;
      }
      Alert.alert('Error', err.errors?.[0]?.message ?? 'Something went wrong');
    } finally {
      setIsVerifying(false);
    }
  };

  if (pendingVerification) {
    return (
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-center mb-2">Verify Email</Text>
        <Text className="text-gray-500 text-center mb-8">
          We sent a verification code to {email}
        </Text>

        <View className={isVerifying ? 'opacity-50' : ''} pointerEvents={isVerifying ? 'none' : 'auto'}>
          <OtpInput onComplete={onVerify} />
        </View>

        {isVerifying ? (
          <Text className="mt-6 text-center text-gray-400">Verifying...</Text>
        ) : (
          <Pressable onPress={() => setPendingVerification(false)}>
            <Text className="mt-6 text-center text-gray-500">
              Go back
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center px-6">
      <Text className="text-3xl font-bold text-center mb-6">Create Account</Text>

      <View className="flex-row gap-3 mb-3">
        <TextInput
          className="flex-1 border border-gray-300 rounded-lg p-4 text-base"
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          className="flex-1 border border-gray-300 rounded-lg p-4 text-base"
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
        />
      </View>

      <TextInput
        className="border border-gray-300 rounded-lg p-4 mb-3 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        className="border border-gray-300 rounded-lg p-4 mb-3 text-base"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        className={`bg-black rounded-lg p-4 items-center mt-2 active:opacity-70 ${isSubmitting ? 'opacity-50' : ''}`}
        onPress={onSignUp}
        disabled={isSubmitting}
      >
        <Text className="text-white text-base font-semibold">
          {isSubmitting ? 'Creating Account...' : 'Sign Up'}
        </Text>
      </Pressable>

      <SsoButtons />

      <Link href="/(public)/sign-in" asChild>
        <Pressable>
          <Text className="mt-4 text-center text-gray-500">
            Already have an account? Sign In
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
