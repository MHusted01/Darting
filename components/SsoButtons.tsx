import { useSSO } from '@clerk/clerk-expo';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';

type SsoStrategy = 'oauth_google' | 'oauth_apple';
type ProviderName = 'Google' | 'Apple';

type SocialButtonProps = {
  label: string;
  iconName: 'google' | 'apple';
  onPress: () => void;
  variant: 'light' | 'dark';
};

function SocialButton({
  label,
  iconName,
  onPress,
  variant,
}: SocialButtonProps) {
  const isDark = variant === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`self-center w-[240px] flex-row items-center justify-center gap-2 rounded-lg py-3 px-4 active:opacity-70 ${
        isDark ? 'bg-black' : 'border border-gray-300 bg-white'
      }`}
      onPress={onPress}
    >
      <FontAwesome
        name={iconName}
        size={iconName === 'apple' ? 18 : 16}
        color={isDark ? 'white' : 'black'}
      />
      <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-black'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SsoButtons() {
  useWarmUpBrowser();
  const router = useRouter();
  const { startSSOFlow } = useSSO();

  const handleSSO = async (strategy: SsoStrategy, provider: ProviderName) => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/sso-callback', { scheme: 'darting' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/(protected)/(tabs)');
      }
    } catch (error: unknown) {
      let message = 'Something went wrong';

      if (
        typeof error === 'object' &&
        error !== null &&
        'errors' in error &&
        Array.isArray((error as any).errors) &&
        (error as any).errors[0]?.message
      ) {
        message = (error as any).errors[0].message;
      }

      Alert.alert(`${provider} Sign In Failed`, message);
    }
  };

  return (
    <View className="mt-6 gap-4">
      <View className="mb-1 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-gray-300" />
        <Text className="text-sm text-gray-400">or continue with</Text>
        <View className="h-px flex-1 bg-gray-300" />
      </View>

      <SocialButton
        label="Continue with Google"
        iconName="google"
        variant="light"
        onPress={() => handleSSO('oauth_google', 'Google')}
      />

      <SocialButton
        label="Continue with Apple"
        iconName="apple"
        variant="dark"
        onPress={() => handleSSO('oauth_apple', 'Apple')}
      />
    </View>
  );
}