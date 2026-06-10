import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GAMES, KILLER_SLUG, BERMUDA_TRIANGLE_SLUG } from '@/constants/games';
import type { TournamentFormat, TournamentSettings } from '@/types/tournament';
import type { CreateTournamentInput } from '@/lib/tournament-api';

const FORMATS: { value: TournamentFormat; label: string; description: string }[] = [
  { value: 'league', label: 'League', description: 'Points table (W=3, D=1, L=0)' },
  { value: 'cup', label: 'Knockout', description: 'Single elimination bracket' },
  { value: 'round_robin', label: 'Round Robin', description: 'Everyone plays everyone' },
];

const LEGS_OPTIONS = [1, 3, 5] as const;

interface CreateTournamentModalProps {
  visible: boolean;
  clubId: string;
  createdBy: string;
  onClose: () => void;
  onSubmit: (input: CreateTournamentInput) => void;
  isLoading?: boolean;
}

export function CreateTournamentModal({
  visible,
  clubId,
  createdBy,
  onClose,
  onSubmit,
  isLoading,
}: CreateTournamentModalProps) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('cup');
  const TOURNAMENT_GAMES = GAMES.filter(g => g.slug !== KILLER_SLUG && g.slug !== BERMUDA_TRIANGLE_SLUG);
  const [gameSlug, setGameSlug] = useState(TOURNAMENT_GAMES[0]?.slug ?? 'x01');
  const [legsPerMatch, setLegsPerMatch] = useState<1 | 3 | 5>(1);
  const [doubleOut, setDoubleOut] = useState(true);

  const isX01 = gameSlug === 'x01';

  function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a tournament name.');
      return;
    }
    const settings: TournamentSettings = { legsPerMatch, doubleOut: isX01 ? doubleOut : false };
    onSubmit({ clubId, divisionId: null, createdBy, name: name.trim(), format, gameSlug, settings });
  }

  function handleClose() {
    setName('');
    setFormat('cup');
    setGameSlug(GAMES[0]?.slug ?? 'x01');
    setLegsPerMatch(1);
    setDoubleOut(true);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-ds-bg">
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">New Tournament</Text>
          <Pressable onPress={handleClose} className="active:opacity-70" accessibilityRole="button" accessibilityLabel="Cancel">
            <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Cancel</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">Name</Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 mb-5">
            <TextInput
              className="py-4 text-base font-barlow text-ds-on-surface"
              placeholder="e.g. Spring Cup 2026"
              placeholderTextColor="#747878"
              value={name}
              onChangeText={setName}
              accessibilityLabel="Tournament name"
            />
          </View>

          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">Format</Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-5">
            {FORMATS.map((f, idx) => (
              <Pressable
                key={f.value}
                onPress={() => setFormat(f.value)}
                className={`px-4 py-3 flex-row items-center justify-between active:opacity-70 ${idx < FORMATS.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: format === f.value }}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-barlow-semi text-ds-on-surface">{f.label}</Text>
                  <Text className="text-xs font-barlow text-ds-on-surface-variant mt-0.5">{f.description}</Text>
                </View>
                <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${format === f.value ? 'border-ds-red bg-ds-red' : 'border-ds-outline'}`}>
                  {format === f.value && <View className="w-2 h-2 rounded-full bg-white" />}
                </View>
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">Game</Text>
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-5">
            {TOURNAMENT_GAMES.map((g, idx) => (
              <Pressable
                key={g.slug}
                onPress={() => setGameSlug(g.slug)}
                className={`px-4 py-3 flex-row items-center justify-between active:opacity-70 ${idx < TOURNAMENT_GAMES.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: gameSlug === g.slug }}
              >
                <Text className="text-sm font-barlow text-ds-on-surface">{g.name}</Text>
                {gameSlug === g.slug && (
                  <View className="w-2 h-2 rounded-full bg-ds-red" />
                )}
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">Legs per match</Text>
          <View className="flex-row gap-3 mb-5">
            {LEGS_OPTIONS.map(legs => (
              <Pressable
                key={legs}
                onPress={() => setLegsPerMatch(legs)}
                className={`flex-1 rounded-xl py-3 items-center active:opacity-70 ${legsPerMatch === legs ? 'bg-ds-red' : 'bg-ds-surface border border-ds-outline-variant'}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: legsPerMatch === legs }}
              >
                <Text className={`text-sm font-barlow-semi ${legsPerMatch === legs ? 'text-white' : 'text-ds-on-surface'}`}>
                  Best of {legs}
                </Text>
              </Pressable>
            ))}
          </View>

          {isX01 && (
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-4 flex-row items-center justify-between mb-5">
              <Text className="text-sm font-barlow-semi text-ds-on-surface">Double out</Text>
              <Switch
                value={doubleOut}
                onValueChange={setDoubleOut}
                trackColor={{ false: '#c4c7c7', true: '#ba1a1a' }}
                thumbColor="white"
                accessibilityLabel="Double out rule"
              />
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            className={`rounded-xl py-4 items-center active:opacity-70 ${isLoading ? 'bg-ds-surface-container' : 'bg-ds-red'}`}
            accessibilityRole="button"
            accessibilityLabel="Create tournament"
          >
            <Text className={`text-lg font-barlow-semi ${isLoading ? 'text-ds-outline' : 'text-white'}`}>
              {isLoading ? 'Creating...' : 'Create Tournament'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
