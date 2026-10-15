/**
 * MOCK data for Build Phase 1 static screens.
 * Isolated here so later phases can delete this directory wholesale.
 * Label: MOCK — not real API data.
 */

export type MockPowerUp = 'SHIELD' | 'RESERVE' | 'PEEK' | 'REVERSE';
export type MockStatCard =
  | 'MEAN'
  | 'TWO_THIRDS'
  | 'MIDRANGE'
  | 'MEAN_PLUS_SIGMA'
  | 'GEOMETRIC_MEAN';

export const MOCK_TEAM = {
  id: 'team-alpha',
  name: 'Team Alpha',
  tag: 'α',
} as const;

export const MOCK_RAPID_FIRE = {
  questionId: 'q-mock-1',
  setLabel: 'Set A · Question 2 of 5',
  prompt: 'What is the only even prime number?',
  timeLimitSeconds: 30,
  remainingSeconds: 18,
  submitted: false,
} as const;

export const MOCK_STAT_CARDS: Record<
  MockStatCard,
  { id: MockStatCard; title: string; formula: string; description: string }
> = {
  MEAN: {
    id: 'MEAN',
    title: 'Mean',
    formula: 'μ = Σx / n',
    description: 'Arithmetic mean of all non-conflicting picks.',
  },
  TWO_THIRDS: {
    id: 'TWO_THIRDS',
    title: 'Two-thirds',
    formula: '(2/3) · μ',
    description: 'Two-thirds of the mean of non-conflicting picks.',
  },
  MIDRANGE: {
    id: 'MIDRANGE',
    title: 'Midrange',
    formula: '(min + max) / 2',
    description: 'Average of the lowest and highest non-conflicting picks.',
  },
  MEAN_PLUS_SIGMA: {
    id: 'MEAN_PLUS_SIGMA',
    title: 'Mean + 1σ',
    formula: 'μ + σ',
    description: 'Mean plus one standard deviation of non-conflicting picks.',
  },
  GEOMETRIC_MEAN: {
    id: 'GEOMETRIC_MEAN',
    title: 'Geometric mean',
    formula: '(∏x)^(1/n)',
    description: 'Geometric mean of all non-conflicting picks.',
  },
};

export const MOCK_ROUND = {
  roundNumber: 3,
  totalRounds: 8,
  phaseLabel: 'Game Phase B — Main Game',
  statCard: MOCK_STAT_CARDS.MEAN,
  selectionSeconds: 60,
} as const;

export const MOCK_INVENTORY: { card: MockPowerUp; count: number; note: string }[] = [
  { card: 'SHIELD', count: 1, note: 'Play before the round opens' },
  { card: 'RESERVE', count: 0, note: 'Only one exists in the whole event' },
  { card: 'PEEK', count: 2, note: 'Reveals count of locked picks under 50' },
  { card: 'REVERSE', count: 1, note: 'Flips majority / minority scoring' },
];

export const MOCK_LEADERBOARD: { rank: number; team: string; score: string }[] = [
  { rank: 1, team: 'Team Gamma', score: '142.3500000123' },
  { rank: 2, team: 'Team Alpha', score: '128.00005' },
  { rank: 3, team: 'Team Beta', score: '97.5' },
  { rank: 4, team: 'Team Delta', score: '12.3456789012' },
  { rank: 5, team: 'Team Epsilon', score: '0' },
];

export const MOCK_ROUND_RESULT = {
  roundNumber: 2,
  target: '47.2500',
  ownPick: 42,
  bucket: 'Less Than' as const,
  scoreDelta: '42.0000',
  clash: false,
  components: {
    exactMatch: '0.0000',
    minority: '42.0000',
    majority: '0.0000',
    clash: '0.0000',
  },
} as const;

export const MOCK_ADMIN_SECTIONS = [
  { id: 'teams', title: 'Teams', blurb: 'Create and manage team accounts.' },
  { id: 'questions', title: 'Questions & Sets', blurb: 'Rapid-fire questions and sets.' },
  { id: 'card-mapping', title: 'Card Mapping', blurb: 'Map power-ups to questions.' },
  { id: 'rounds', title: 'Rounds & Stat Cards', blurb: 'Configure rounds and formulas.' },
  { id: 'settings', title: 'Event Settings', blurb: 'Timers and rule configuration.' },
  { id: 'live', title: 'Live Monitor', blurb: 'Watch picks and connections live.' },
  { id: 'leaderboard', title: 'Leaderboard', blurb: 'Scores to 4 decimal places.' },
] as const;

/** Fisher–Yates shuffle for MOCK palette layout demo (client-side only). */
export function shuffleNumbers(seed?: number): number[] {
  const nums = Array.from({ length: 100 }, (_, i) => i + 1);
  // Simple seeded LCG for reproducible demos when seed provided.
  let state = seed ?? Date.now() % 2147483647;
  const rand = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  for (let i = nums.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = nums[i]!;
    nums[i] = nums[j]!;
    nums[j] = tmp;
  }
  return nums;
}
