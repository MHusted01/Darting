import { useSignIn } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, Pressable, View, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import SsoButtons from '@/components/SsoButtons';

WebBrowser.maybeCompleteAuthSession();

/**
 * Render the sign-in screen with email/password inputs, SSO buttons, and a link to sign up.
 *
 * Attempts to authenticate using the entered credentials; if authentication completes successfully
 * the new session is activated and the router navigates to the protected tabs route. On failure,
 * an alert is shown with the first available error message or a generic fallback.
 *
 * @returns The sign-in screen's JSX element.
 */
export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSignIn = async () => {
    if (!isLoaded) return;

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(protected)/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message ?? 'Something went wrong');
    }
  };

  return (
    <View className="flex-1 justify-center px-6">
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
        className="bg-black rounded-lg p-4 items-center mt-2 active:opacity-70"
        onPress={onSignIn}
      >
        <Text className="text-white text-base font-semibold">Sign In</Text>
      </Pressable>

      <SsoButtons />

      <Link href="/(public)/sign-up" asChild>
        <Pressable>
          <Text className="mt-4 text-center text-gray-500">
            Don{`'`}t have an account? Sign Up
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
