import { useSignIn } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import SsoButtons from '@/components/SsoButtons';
import { getErrorMessage } from '@/lib/errors';

WebBrowser.maybeCompleteAuthSession();
/**
 * Renders the sign-in screen with email/password inputs, SSO options, and a sign-up link.
 *
 * Attempts to authenticate using the entered credentials; on successful authentication the new
 * session is activated and navigation is replaced with the protected tabs route. On failure,
 * an alert is shown with a user-facing error message, and when additional verification is
 * required an alert indicates the incomplete sign-in status.
 *
 * @returns The sign-in screen's JSX element.
 */
export default function SignIn() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSignIn = async () => {
    if (isSubmitting || fetchStatus === 'fetching') return;
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
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          Alert.alert('Error', getErrorMessage(finalizeError));
          return;
        }
        router.replace('/(protected)/(tabs)');
        return;
      }

      Alert.alert('Sign in incomplete', 'Please complete additional verification to continue.');
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 justify-center px-6">
      <Text className="text-3xl font-bold text-center mb-6">Sign In</Text>

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
        testID="sign-in-button"
        accessibilityRole="button"
        accessibilityLabel="Sign In"
        className={`bg-black rounded-lg p-4 items-center mt-2 active:opacity-70 ${isSubmitting ? 'opacity-50' : ''}`}
        onPress={onSignIn}
        disabled={isSubmitting}
      >
        <Text className="text-white text-base font-semibold">
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </Text>
      </Pressable>

      <SsoButtons />

      <Link href="/(public)/sign-up" asChild>
        <Pressable>
          <Text className="mt-4 text-center text-gray-500">
            Don{`'`}t have an account? Sign Up
          </Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
