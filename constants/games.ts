import type { LucideIcon } from 'lucide-react-native';
import {
  Crosshair,
  RotateCw,
  Layers,
  Diamond,
  Skull,
  Percent,
  Triangle,
  Target,
  Trophy,
} from 'lucide-react-native';

export type GameCategory = 'Classic' | 'Party' | 'Practice';
export type GameDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface DartGame {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  playerCount: string;
  difficulty: GameDifficulty;
  category: GameCategory;
}

export interface GameSection {
  title: GameCategory;
  data: DartGame[];
}

export const AROUND_THE_CLOCK_SLUG = 'around-the-clock';
export const CRICKET_SLUG = 'cricket';

export const GAMES: DartGame[] = [
  {
    slug: CRICKET_SLUG,
    name: 'Cricket',
    description: 'Close 15 through 20 and the Bull. Tactical and competitive.',
    icon: Crosshair,
    playerCount: '2+',
    difficulty: 'Intermediate',
    category: 'Classic',
  },
  {
    slug: AROUND_THE_CLOCK_SLUG,
    name: 'Around the Clock',
    description: 'Hit 1 through 20 in order. Perfect for beginners.',
    icon: RotateCw,
    playerCount: '1+',
    difficulty: 'Beginner',
    category: 'Classic',
  },
  {
    slug: 'shanghai',
    name: 'Shanghai',
    description: 'Score on the target number each round. Hit a Shanghai to win instantly.',
    icon: Layers,
    playerCount: '2+',
    difficulty: 'Intermediate',
    category: 'Classic',
  },
  {
    slug: 'baseball',
    name: 'Baseball',
    description: 'Nine innings of darts. Highest score after 9 rounds wins.',
    icon: Diamond,
    playerCount: '2+',
    difficulty: 'Beginner',
    category: 'Classic',
  },
  {
    slug: 'killer',
    name: 'Killer',
    description: 'Assigned numbers, earn Killer status, then eliminate opponents.',
    icon: Skull,
    playerCount: '3+',
    difficulty: 'Intermediate',
    category: 'Party',
  },
  {
    slug: 'halve-it',
    name: 'Halve-It',
    description: 'Hit each target or lose half your score. High risk, high reward.',
    icon: Percent,
    playerCount: '2+',
    difficulty: 'Intermediate',
    category: 'Party',
  },
  {
    slug: 'bermuda-triangle',
    name: 'Bermuda Triangle',
    description: 'Avoid the penalty zones as targets shift each round.',
    icon: Triangle,
    playerCount: '2+',
    difficulty: 'Advanced',
    category: 'Party',
  },
  {
    slug: 'bobs-27',
    name: "Bob's 27",
    description: 'Start with 27 points. Hit doubles to add, miss to subtract.',
    icon: Target,
    playerCount: '1+',
    difficulty: 'Advanced',
    category: 'Practice',
  },
  {
    slug: 'high-score',
    name: 'High Score',
    description: 'Throw for maximum points. Simple, fast, and satisfying.',
    icon: Trophy,
    playerCount: '1+',
    difficulty: 'Beginner',
    category: 'Practice',
  },
];

export const GAME_SECTIONS: GameSection[] = [
  { title: 'Classic', data: GAMES.filter((g) => g.category === 'Classic') },
  { title: 'Party', data: GAMES.filter((g) => g.category === 'Party') },
  { title: 'Practice', data: GAMES.filter((g) => g.category === 'Practice') },
];
