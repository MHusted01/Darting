import { Text, View } from 'react-native';
import { DS_COLORS } from '@/constants/colors';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { ChevronRight } from 'lucide-react-native';

interface DrillCatalogueItemProps {
  name: string;
  description: string;
  benchmarkTarget: string;
  onPress: () => void;
  isLast?: boolean;
}

export default function DrillCatalogueItem({
  name,
  description,
  benchmarkTarget,
  onPress,
  isLast = false,
}: DrillCatalogueItemProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={name}
      className={`px-4 py-4 flex-row items-center justify-between active:opacity-70${isLast ? '' : ' border-b border-ds-outline-variant'}`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-base font-barlow-semi text-ds-on-surface">{name}</Text>
        <Text numberOfLines={1} className="text-sm font-barlow text-ds-on-surface-variant">
          {description}
        </Text>
        <Text className="text-xs font-barlow-semi text-ds-red mt-0.5">{benchmarkTarget}</Text>
      </View>
      <ChevronRight size={18} color={DS_COLORS.outline} />
    </AnimatedPressable>
  );
}
