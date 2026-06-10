import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

let lastHandledNotificationId: string | null = null;

export function useNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const notificationId = response.notification.request.identifier;
      if (notificationId === lastHandledNotificationId) return;
      const data = response.notification.request.content.data as
        | { type?: string; challengeId?: string }
        | undefined;
      if (data?.type === 'game_challenge' && typeof data.challengeId === 'string') {
        lastHandledNotificationId = notificationId;
        router.push(`/challenge/${data.challengeId}`);
      }
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [router]);
}
