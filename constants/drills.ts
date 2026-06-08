export interface Drill {
  slug: string;
  name: string;
  description: string;
  howToScore: string;
  benchmarkTarget: string;
}

export const DRILLS: Drill[] = [
  {
    slug: 'practice-doubles',
    name: 'Double Practice',
    description: 'Cycle through every double (D1–D20 + bull) throwing 3 darts at each. Record hits.',
    howToScore: 'Count total doubles hit out of 63 attempts (21 targets × 3 darts each).',
    benchmarkTarget: '35+ hits (55%+)',
  },
  {
    slug: 'reduce-busts',
    name: 'Checkout Accuracy',
    description: 'Start each leg from 100. Practise finishing in 2 visits without busting.',
    howToScore: 'Track legs finished vs busted. Target: 3 busts or fewer per 10 legs.',
    benchmarkTarget: '≤ 3 busts per 10 legs',
  },
  {
    slug: 'cricket-consistency',
    name: 'Cricket Marks',
    description: 'Throw 3 darts at each cricket segment (15–20, bull) in sequence. Aim for 3 marks per visit.',
    howToScore: 'Total marks scored across all 7 segments × 3 darts = 63 darts. Target 35+ marks.',
    benchmarkTarget: '35+ marks from 63 darts',
  },
  {
    slug: 'atc-accuracy',
    name: 'Clock Precision',
    description: 'Play Around the Clock solo. Record darts thrown per number. Focus on numbers that took 4+ darts.',
    howToScore: 'Total darts to complete 1–20. Benchmark: ≤ 60 darts.',
    benchmarkTarget: '≤ 60 darts for 1–20',
  },
];

export const DRILL_MAP = new Map(DRILLS.map((d) => [d.slug, d]));
