import { Text, View } from 'react-native';
import { MAX_FONT_SCALE_DENSE } from '@/constants/typography';

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export default function KPICard({ label, value, subtitle }: KPICardProps) {
  return (
    <View className="flex-1 bg-ds-surface border border-ds-outline-variant rounded-xl p-4">
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE_DENSE}
        className="text-3xl font-barlow-bold text-ds-on-surface leading-none"
      >
        {String(value)}
      </Text>
      {subtitle != null && (
        <Text testID="kpi-card-subtitle" className="text-xs font-barlow text-ds-on-surface-variant mt-1">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
