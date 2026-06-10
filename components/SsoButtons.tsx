import { useSSO } from '@clerk/expo';
import { DS_COLORS } from '@/constants/colors';
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

function SocialButton({ label, iconName, onPress, variant }: SocialButtonProps) {
  const isDark = variant === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`w-full flex-row items-center justify-center gap-3 rounded-xl py-4 px-4 active:opacity-70 ${
        isDark ? 'bg-ds-on-surface' : 'bg-ds-surface border border-ds-outline-variant'
      }`}
      onPress={onPress}
    >
      <FontAwesome
        name={iconName}
        size={18}
        color={isDark ? DS_COLORS.onRed : DS_COLORS.onSurface}
      />
      <Text className={`text-base font-barlow-semi ${isDark ? 'text-ds-on-red' : 'text-ds-on-surface'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SsoButtonsProps {
  signUpMode?: boolean;
}

export default function SsoButtons({ signUpMode = false }: SsoButtonsProps) {
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
        Array.isArray((error as { errors: unknown[] }).errors) &&
        (error as { errors: { message: string }[] }).errors[0]?.message
      ) {
        message = (error as { errors: { message: string }[] }).errors[0].message;
      }

      Alert.alert(`${provider} Authentication Failed`, message);
    }
  };

  const dividerLabel = signUpMode ? 'Or sign up with' : 'Or continue with';

  return (
    <View className="mt-6 gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-ds-outline-variant" />
        <Text className="text-sm font-barlow text-ds-on-surface-variant">{dividerLabel}</Text>
        <View className="h-px flex-1 bg-ds-outline-variant" />
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
