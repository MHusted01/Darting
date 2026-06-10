import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type ImpactStyle = 'light' | 'medium' | 'heavy';
export type NotifyType = 'success' | 'warning' | 'error';

const IMPACT_STYLES: Record<ImpactStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFY_TYPES: Record<NotifyType, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

export async function impact(style: ImpactStyle = 'light'): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(IMPACT_STYLES[style]);
  } catch {
  }
}

export async function notify(type: NotifyType = 'success'): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(NOTIFY_TYPES[type]);
  } catch {
  }
}

export async function selection(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
  }
}
