import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

export default function Settings() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(public)/sign-in');
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message ?? 'Something went wrong');
    }
  };

  return (
    <View className="flex-1 justify-center px-6">
      <Text className="text-3xl font-bold text-center mb-8">Settings</Text>

      <Pressable
        className="border border-red-500 rounded-lg p-4 items-center active:opacity-70"
        onPress={handleSignOut}
      >
        <Text className="text-red-500 text-base font-semibold">Sign Out</Text>
      </Pressable>
    </View>
  );
}
