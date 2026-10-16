import type { MatchingMode, PowerUpCard, QuestionType, RapidFireTieBreak } from './eventConfig.js';

export const RAPID_FIRE_STATUSES = ['IDLE', 'QUESTION_OPEN', 'CLOSED', 'AWARDED'] as const;
export type RapidFireStatus = (typeof RAPID_FIRE_STATUSES)[number];

export function isValidRapidFireStatus(val: unknown): val is RapidFireStatus {
  return typeof val === 'string' && (RAPID_FIRE_STATUSES as readonly string[]).includes(val);
}

export function normalizeAnswer(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateAnswer(
  rawAnswer: string,
  answerDefinition: string,
  mode: MatchingMode,
  questionType?: QuestionType,
  options?: string[] | null,
): boolean {
  const ans = rawAnswer.trim();
  const def = answerDefinition.trim();
  if (!ans || !def) return false;

  if (questionType === 'MCQ' && options && options.length > 0) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    // 1. Direct match (normalized)
    if (normalizeAnswer(ans) === normalizeAnswer(def)) return true;

    // 2. Resolve target option index from answerDefinition (if it's A/B/C/D or 0/1/2/3)
    const defUpper = def.toUpperCase();
    const defLetterIdx = letters.indexOf(defUpper);
    const defNumIdx = /^\d+$/.test(def) ? parseInt(def, 10) : -1;
    const targetIdx = defLetterIdx >= 0 ? defLetterIdx : (defNumIdx >= 0 && defNumIdx < options.length ? defNumIdx : -1);

    if (targetIdx >= 0 && targetIdx < options.length) {
      const correctOptText = options[targetIdx];
      if (normalizeAnswer(ans) === normalizeAnswer(correctOptText)) return true;
    }

    // 3. Resolve user option index from rawAnswer (if user submitted A/B/C/D or 0/1/2/3)
    const ansUpper = ans.toUpperCase();
    const ansLetterIdx = letters.indexOf(ansUpper);
    const ansNumIdx = /^\d+$/.test(ans) ? parseInt(ans, 10) : -1;
    const userIdx = ansLetterIdx >= 0 ? ansLetterIdx : (ansNumIdx >= 0 && ansNumIdx < options.length ? ansNumIdx : -1);

    if (userIdx >= 0 && userIdx < options.length) {
      const userOptText = options[userIdx];
      if (normalizeAnswer(userOptText) === normalizeAnswer(def)) return true;
      if (targetIdx >= 0 && userIdx === targetIdx) return true;
    }
  }

  switch (mode) {
    case 'EXACT':
      return ans === def;
    case 'NORMALIZED':
      return normalizeAnswer(ans) === normalizeAnswer(def);
    case 'NUMERIC': {
      const a = Number(ans);
      const b = Number(def);
      return Number.isFinite(a) && Number.isFinite(b) && a === b;
    }
    default:
      return normalizeAnswer(ans) === normalizeAnswer(def);
  }
}

export interface RapidFireSubmissionCandidate {
  id: string;
  teamId: string;
  receivedAt: Date | string;
  isCorrect: boolean;
  attemptNumber: number;
}

export interface RapidFireAwardAllocation {
  teamId: string;
  cardType: PowerUpCard;
  rank: number;
  receivedAt: string;
  reason: string;
}

export interface AllocateAwardsParams {
  submissions: RapidFireSubmissionCandidate[];
  topN: number;
  mappedCard: PowerUpCard | null;
  availableSupply: number;
  tieBreak: RapidFireTieBreak;
}

export function allocateRapidFireAwards({
  submissions,
  topN,
  mappedCard,
  availableSupply,
  tieBreak,
}: AllocateAwardsParams): RapidFireAwardAllocation[] {
  if (!mappedCard || topN <= 0 || availableSupply <= 0) {
    return [];
  }

  // Filter for correct submissions
  const correct = submissions.filter((s) => s.isCorrect);
  if (correct.length === 0) return [];

  // Earliest correct submission per team
  const earliestByTeam = new Map<string, RapidFireSubmissionCandidate>();
  for (const sub of correct) {
    const existing = earliestByTeam.get(sub.teamId);
    const subTime = new Date(sub.receivedAt).getTime();
    if (!existing || subTime < new Date(existing.receivedAt).getTime()) {
      earliestByTeam.set(sub.teamId, sub);
    }
  }

  const teamCandidates = Array.from(earliestByTeam.values());

  // Sort candidate submissions
  teamCandidates.sort((a, b) => {
    const timeA = new Date(a.receivedAt).getTime();
    const timeB = new Date(b.receivedAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.teamId.localeCompare(b.teamId);
  });

  const allocations: RapidFireAwardAllocation[] = [];
  let remainingSupply = availableSupply;

  if (tieBreak === 'EARLIEST_RECEIVED_THEN_ID') {
    const winners = teamCandidates.slice(0, Math.min(topN, remainingSupply));
    for (let i = 0; i < winners.length; i++) {
      const w = winners[i];
      allocations.push({
        teamId: w.teamId,
        cardType: mappedCard,
        rank: i + 1,
        receivedAt: new Date(w.receivedAt).toISOString(),
        reason: `Rank ${i + 1} with correct answer received at ${new Date(w.receivedAt).toISOString()}`,
      });
    }
    return allocations;
  }

  // tieBreak === 'SHARE'
  // Group by timestamp
  let currentRank = 1;
  let idx = 0;
  while (idx < teamCandidates.length && allocations.length < topN && remainingSupply > 0) {
    const groupTime = new Date(teamCandidates[idx].receivedAt).getTime();
    const group: RapidFireSubmissionCandidate[] = [];
    while (idx < teamCandidates.length && new Date(teamCandidates[idx].receivedAt).getTime() === groupTime) {
      group.push(teamCandidates[idx]);
      idx++;
    }

    // If mappedCard is RESERVE, hard limit max 1 ever awarded across the game
    if (mappedCard === 'RESERVE' && remainingSupply === 1 && group.length > 1) {
      // Cannot share Reserve; award to earliest team ID
      const singleWinner = group[0];
      allocations.push({
        teamId: singleWinner.teamId,
        cardType: mappedCard,
        rank: currentRank,
        receivedAt: new Date(singleWinner.receivedAt).toISOString(),
        reason: `Rank ${currentRank} (Reserve cannot be duplicated; assigned deterministically)`,
      });
      remainingSupply--;
      break;
    }

    if (group.length <= remainingSupply) {
      for (const w of group) {
        allocations.push({
          teamId: w.teamId,
          cardType: mappedCard,
          rank: currentRank,
          receivedAt: new Date(w.receivedAt).toISOString(),
          reason: `Rank ${currentRank} (tied at timestamp)`,
        });
      }
      remainingSupply -= group.length;
    } else {
      // Partial group fits in supply
      const winners = group.slice(0, remainingSupply);
      for (const w of winners) {
        allocations.push({
          teamId: w.teamId,
          cardType: mappedCard,
          rank: currentRank,
          receivedAt: new Date(w.receivedAt).toISOString(),
          reason: `Rank ${currentRank} (supply cap reached)`,
        });
      }
      remainingSupply = 0;
      break;
    }

    currentRank += group.length;
  }

  return allocations;
}

export interface RapidFireTeamView {
  status: RapidFireStatus;
  question: {
    id: string;
    prompt: string;
    timeLimitSeconds: number;
    openedAt: string | null;
    remainingSeconds: number;
    mappedCard: PowerUpCard | null;
    topN: number;
    questionType: QuestionType;
    options: string[] | null;
  } | null;
  teamSubmission: {
    submitted: boolean;
    attemptCount: number;
    maxAttempts: number;
    canSubmit: boolean;
    lastReceivedAt: string | null;
  };
  award: {
    won: boolean;
    cardType: PowerUpCard | null;
    rank: number | null;
  } | null;
}

export interface RapidFireAdminSubmission {
  id: string;
  teamId: string;
  teamName: string;
  rawAnswer: string;
  isCorrect: boolean;
  attemptNumber: number;
  receivedAt: string;
}

export interface RapidFireAdminAward {
  teamId: string;
  teamName: string;
  cardType: PowerUpCard;
  rank: number;
  receivedAt: string;
  reason: string;
}

export interface RapidFireAdminState {
  status: RapidFireStatus;
  question: {
    id: string;
    prompt: string;
    answerDefinition: string;
    matchingMode: MatchingMode;
    timeLimitSeconds: number;
    mappedCard: PowerUpCard | null;
    topN: number;
    openedAt: string | null;
    closedAt: string | null;
    awardedAt: string | null;
    questionType: QuestionType;
    options: string[] | null;
  } | null;
  submissions: RapidFireAdminSubmission[];
  awards: RapidFireAdminAward[];
  remainingCardSupply: Record<PowerUpCard, number>;
}

export interface TeamCardItem {
  id: string;
  cardType: PowerUpCard;
  acquiredFrom: string;
  createdAt: string;
  usedInRoundId: string | null;
}
