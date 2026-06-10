import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { AROUND_THE_CLOCK_SLUG, GAMES, KILLER_SLUG, X01_SLUG } from '@/constants/games';
import type { ChallengeSettings } from '@/lib/realtime-game';

const CHALLENGE_GAMES = GAMES.filter((g) => g.slug !== KILLER_SLUG);

interface ChallengeSheetProps {
  visible: boolean;
  opponentName: string;
  onClose: () => void;
  onSubmit: (gameSlug: string, settings: ChallengeSettings) => void;
  isLoading?: boolean;
}

export function ChallengeSheet({
  visible,
  opponentName,
  onClose,
  onSubmit,
  isLoading,
}: ChallengeSheetProps) {
  const [gameSlug, setGameSlug] = useState(X01_SLUG);
  const [startingScore, setStartingScore] = useState<501 | 301>(501);
  const [includeBull, setIncludeBull] = useState(false);

  const isX01 = gameSlug === X01_SLUG;
  const isATC = gameSlug === AROUND_THE_CLOCK_SLUG;

  function handleSubmit() {
    const settings: ChallengeSettings = {
      ...(isX01 ? { startingScore } : {}),
      ...(isATC ? { includeBull } : {}),
    };
    onSubmit(gameSlug, settings);
  }

  function handleClose() {
    setGameSlug(X01_SLUG);
    setStartingScore(501);
    setIncludeBull(false);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-ds-bg">
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">
            Challenge {opponentName}
          </Text>
          <Pressable
            onPress={handleClose}
            className="active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
            Game
          </Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-5">
            {CHALLENGE_GAMES.map((g, idx) => (
              <Pressable
                key={g.slug}
                onPress={() => setGameSlug(g.slug)}
                className={`px-4 py-3 flex-row items-center justify-between active:opacity-70 ${
                  idx < CHALLENGE_GAMES.length - 1 ? 'border-b border-ds-outline-variant' : ''
                }`}
                accessibilityRole="radio"
                accessibilityState={{ checked: gameSlug === g.slug }}
              >
                <Text className="text-sm font-barlow-semi text-ds-on-surface">{g.name}</Text>
                <View
                  className={`w-4 h-4 rounded-full border-2 items-center justify-center ${
                    gameSlug === g.slug ? 'border-ds-red bg-ds-red' : 'border-ds-outline'
                  }`}
                >
                  {gameSlug === g.slug && <View className="w-2 h-2 rounded-full bg-white" />}
                </View>
              </Pressable>
            ))}
          </View>

          {isX01 && (
            <>
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
                Starting Score
              </Text>
              <View className="flex-row gap-3 mb-5">
                {([501, 301] as const).map((score) => (
                  <Pressable
                    key={score}
                    onPress={() => setStartingScore(score)}
                    className={`flex-1 rounded-xl py-3 items-center border active:opacity-70 ${
                      startingScore === score
                        ? 'bg-ds-red border-ds-red'
                        : 'bg-ds-surface border-ds-outline-variant'
                    }`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: startingScore === score }}
                  >
                    <Text
                      className={`text-base font-barlow-semi ${
                        startingScore === score ? 'text-white' : 'text-ds-on-surface'
                      }`}
                    >
                      {score}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {isATC && (
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-3 flex-row items-center justify-between mb-5">
              <Text className="text-sm font-barlow-semi text-ds-on-surface">Include Bull</Text>
              <Switch
                value={includeBull}
                onValueChange={setIncludeBull}
                accessibilityLabel="Include Bull"
              />
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send challenge"
            className={`bg-ds-red rounded-xl py-4 items-center active:opacity-70 ${isLoading ? 'opacity-50' : ''}`}
          >
            <Text className="text-white text-base font-barlow-semi">
              {isLoading ? 'Sending…' : 'Send Challenge'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
