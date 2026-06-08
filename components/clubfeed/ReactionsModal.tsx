import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useCommentReactions, usePostReactions } from '@/hooks/useClubFeed';
import type { ReactorUser, ReactionType } from '@/types/social';

const REACTION_LABELS: Record<ReactionType, string> = {
  thumbs_up: '👍',
  thumbs_down: '👎',
  bullseye: '🎯',
  fire: '🔥',
};

const REACTION_ORDER: ReactionType[] = ['thumbs_up', 'thumbs_down', 'bullseye', 'fire'];

type Target =
  | { kind: 'post'; postId: string }
  | { kind: 'comment'; commentId: string };

interface Props {
  visible: boolean;
  target: Target;
  onClose: () => void;
}

function useReactors(target: Target, enabled: boolean) {
  const postResult = usePostReactions(
    target.kind === 'post' ? target.postId : '',
    enabled && target.kind === 'post',
  );
  const commentResult = useCommentReactions(
    target.kind === 'comment' ? target.commentId : '',
    enabled && target.kind === 'comment',
  );
  return target.kind === 'post' ? postResult : commentResult;
}

function displayName(r: ReactorUser): string {
  return [r.firstName, r.lastName].filter(Boolean).join(' ') || r.username || 'Unknown';
}

export function ReactionsModal({ visible, target, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ReactionType | 'all'>('all');
  const { data: reactors, isLoading } = useReactors(target, visible);

  const all = reactors ?? [];
  const tabs: Array<{ key: ReactionType | 'all'; label: string; count: number }> = [
    { key: 'all', label: 'All', count: all.length },
    ...REACTION_ORDER
      .map((type) => ({ key: type as ReactionType | 'all', label: REACTION_LABELS[type], count: all.filter((r) => r.reactionType === type).length }))
      .filter((t) => t.count > 0),
  ];

  const visible_reactors = activeTab === 'all' ? all : all.filter((r) => r.reactionType === activeTab);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-ds-bg" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Reactions</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color="#444748" />
          </Pressable>
        </View>

        {tabs.length > 1 && (
          <View className="flex-row border-b border-ds-outline-variant px-2">
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab.key }}
                onPress={() => setActiveTab(tab.key)}
                className={`px-4 py-3 items-center active:opacity-70 ${activeTab === tab.key ? 'border-b-2 border-ds-red' : ''}`}
              >
                <Text className={`text-sm font-barlow-semi ${activeTab === tab.key ? 'text-ds-red' : 'text-ds-on-surface-variant'}`}>
                  {tab.label} {tab.count > 0 && <Text className="text-xs">{tab.count}</Text>}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color="#ba1a1a" style={{ paddingVertical: 32 }} />
        ) : all.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm font-barlow text-ds-outline">No reactions yet</Text>
          </View>
        ) : (
          <FlatList
            data={visible_reactors}
            keyExtractor={(item) => `${item.userId}-${item.reactionType}`}
            renderItem={({ item }) => (
              <View className="flex-row items-center gap-3 px-6 py-3 border-b border-ds-outline-variant">
                <View className="w-9 h-9 rounded-full bg-ds-surface-container items-center justify-center">
                  <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">
                    {(item.firstName?.[0] ?? item.username?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <Text className="flex-1 text-sm font-barlow-semi text-ds-on-surface">
                  {displayName(item)}
                </Text>
                <Text className="text-lg">{REACTION_LABELS[item.reactionType]}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}
