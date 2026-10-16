import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  evaluatePeek,
  generateShuffledPalette,
  scoreRound,
  validateCardPlay,
  type EngineRuleConfig,
} from '@digiverse/game-engine';
import {
  formatScore,
  type PowerUpCard,
  type StatCard,
} from '@digiverse/shared';
import Decimal from 'decimal.js';
import type { Db } from '../db/client.js';
import {
  eventRules,
  gameRounds,
  roundAuditLogs,
  roundCardPlays,
  roundConfigs,
  roundPalettes,
  roundPicks,
  scoreLedger,
  teamCards,
  teams,
} from '../db/schema.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { getActiveEvent } from './rapidFireService.js';
import { broadcastToAdmins, broadcastToAll } from './realtime.js';

export async function ensureStartingPoints(db: Db, eventId: string): Promise<void> {
  const allTeams = await db.select().from(teams);

  for (const t of allTeams) {
    const [existing] = await db
      .select()
      .from(scoreLedger)
      .where(and(eq(scoreLedger.eventId, eventId), eq(scoreLedger.teamId, t.id)))
      .limit(1);

    if (!existing) {
      await db.insert(scoreLedger).values({
        eventId,
        teamId: t.id,
        component: 'STARTING_POINTS',
        pointsDelta: '100',
        balanceAfter: '100',
        reason: 'Phase 2 starting points (OPEN-026)',
      });
    }
  }
}

export async function getTeamScoresMap(
  db: Db,
  eventId: string,
): Promise<Record<string, string>> {
  const allTeams = await db.select().from(teams);
  const scores: Record<string, string> = {};

  for (const t of allTeams) {
    const entries = await db
      .select()
      .from(scoreLedger)
      .where(and(eq(scoreLedger.eventId, eventId), eq(scoreLedger.teamId, t.id)))
      .orderBy(asc(scoreLedger.createdAt));

    let balance = new Decimal(0);
    for (const entry of entries) {
      balance = balance.plus(new Decimal(entry.pointsDelta));
    }
    scores[t.id] = balance.toString();
  }

  return scores;
}

export async function getCurrentRound(db: Db, eventId: string) {
  const [current] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.eventId, eventId))
    .orderBy(desc(gameRounds.roundNumber))
    .limit(1);

  return current ?? null;
}

export async function startRound(
  db: Db,
  params: {
    eventId: string;
    roundNumber?: number;
    statCard?: StatCard;
    lobbySeconds?: number;
    selectionSeconds?: number;
    isPractice?: boolean;
    scoreMultiplier?: number;
  },
) {
  const evt = await getActiveEvent(db, params.eventId);
  if (evt.status !== 'LIVE' && evt.status !== 'READY') {
    throw conflict(`Cannot start round while event is in status ${evt.status}`);
  }

  // Ensure no active round is currently underway
  const current = await getCurrentRound(db, evt.id);
  if (current && current.status !== 'RESULT' && current.status !== 'ABORTED') {
    throw conflict(
      `Round ${current.roundNumber} is still active in state ${current.status}. Complete or abort it first.`,
    );
  }

  await ensureStartingPoints(db, evt.id);

  const roundNum = params.roundNumber ?? (current ? current.roundNumber + 1 : 1);

  // Look up statCard in roundConfigs if not explicitly passed
  let card = params.statCard;
  let timerSecs = params.selectionSeconds ?? evt.roundSelectionSeconds;

  if (!card) {
    const [cfg] = await db
      .select()
      .from(roundConfigs)
      .where(
        and(
          eq(roundConfigs.eventId, evt.id),
          eq(roundConfigs.gamePhase, 'B'),
          eq(roundConfigs.roundNumber, roundNum),
        ),
      )
      .limit(1);

    if (cfg?.statCard) {
      card = cfg.statCard as StatCard;
      timerSecs = cfg.timerSeconds;
    } else {
      card = 'MEAN';
    }
  }

  const lobbySecs = params.lobbySeconds ?? evt.statCardAnnouncementSeconds ?? 15;

  const [newRound] = await db
    .insert(gameRounds)
    .values({
      eventId: evt.id,
      roundNumber: roundNum,
      statCard: card,
      status: 'LOBBY',
      lobbySeconds: lobbySecs,
      selectionSeconds: timerSecs,
      lobbyStartedAt: new Date(),
      isPractice: params.isPractice ?? false,
      scoreMultiplier: params.scoreMultiplier ?? 1,
    })
    .returning();

  // Generate palettes for all teams
  const allTeams = await db.select().from(teams);
  for (const t of allTeams) {
    const seed = `${newRound.id}-${t.id}-${roundNum}`;
    const numbers = generateShuffledPalette(seed);
    await db.insert(roundPalettes).values({
      roundId: newRound.id,
      teamId: t.id,
      paletteNumbers: JSON.stringify(numbers),
      seed,
    });
  }

  broadcastToAll('round:lobby', {
    roundId: newRound.id,
    roundNumber: newRound.roundNumber,
    statCard: newRound.statCard,
    status: 'LOBBY',
    lobbySeconds: newRound.lobbySeconds,
    selectionSeconds: newRound.selectionSeconds,
    lobbyStartedAt: newRound.lobbyStartedAt,
  });

  return newRound;
}

export async function advanceRoundToSelection(db: Db, roundId: string) {
  const [round] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  if (!round) throw notFound('Round not found');
  if (round.status !== 'LOBBY') {
    throw conflict(`Cannot advance to selection from status ${round.status}`);
  }

  const [updated] = await db
    .update(gameRounds)
    .set({
      status: 'SELECTION',
      selectionStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(gameRounds.id, roundId))
    .returning();

  broadcastToAll('round:selection_opened', {
    roundId: updated.id,
    roundNumber: updated.roundNumber,
    status: 'SELECTION',
    selectionStartedAt: updated.selectionStartedAt,
    selectionSeconds: updated.selectionSeconds,
  });

  return updated;
}

export async function playRoundCard(
  db: Db,
  params: {
    roundId: string;
    teamId: string;
    cardType: PowerUpCard;
    reservedNumber?: number;
  },
) {
  const { roundId, teamId, cardType, reservedNumber } = params;

  const [round] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  if (!round) throw notFound('Round not found');

  const currentPhase = round.status === 'LOBBY' ? 'LOBBY' : round.status === 'SELECTION' ? 'SELECTION' : null;
  if (!currentPhase) {
    throw conflict(`Cards cannot be played while round is in state ${round.status}`);
  }

  // Count available unused cards of this type held by team
  const availableCards = await db
    .select()
    .from(teamCards)
    .where(
      and(
        eq(teamCards.teamId, teamId),
        eq(teamCards.cardType, cardType),
        isNull(teamCards.usedInRoundId),
      ),
    );

  const cardsHeld = availableCards.length;

  // Check how many cards team has played this round
  const playedCards = await db
    .select()
    .from(roundCardPlays)
    .where(
      and(eq(roundCardPlays.roundId, roundId), eq(roundCardPlays.teamId, teamId)),
    );

  const validation = validateCardPlay(
    cardType,
    currentPhase,
    cardsHeld,
    playedCards.length,
  );

  if (!validation.valid) {
    throw badRequest(validation.error ?? 'Invalid card play');
  }

  // Card specific validations
  let metadataObj: Record<string, unknown> | undefined;

  if (cardType === 'RESERVE') {
    if (!reservedNumber || reservedNumber < 1 || reservedNumber > 100) {
      throw badRequest('Reserve card requires a reservedNumber between 1 and 100');
    }

    // Check if any other team already reserved a number
    const existingReserve = await db
      .select()
      .from(roundCardPlays)
      .where(
        and(
          eq(roundCardPlays.roundId, roundId),
          eq(roundCardPlays.cardType, 'RESERVE'),
        ),
      );

    if (existingReserve.length > 0) {
      throw conflict('A Reserve card has already been played in this round');
    }

    metadataObj = { reservedNumber };

    // Auto lock as team pick per OPEN-028
    await db.insert(roundPicks).values({
      roundId,
      teamId,
      pick: reservedNumber,
      isLocked: true,
      isReservePick: true,
    });

    // Broadcast reserved number anonymously so other teams' UI can grey it out
    broadcastToAll('round:number_reserved', {
      roundId,
      reservedNumber,
    });
  } else if (cardType === 'PEEK') {
    const allPicks = await db
      .select()
      .from(roundPicks)
      .where(eq(roundPicks.roundId, roundId));

    const peekRes = evaluatePeek(
      allPicks.map((p) => ({ teamId: p.teamId, pick: p.pick })),
      teamId,
    );

    metadataObj = { peekCount: peekRes.count };
  } else if (cardType === 'REVERSE') {
    const newReverseCount = round.reverseCount + 1;
    const isReversed = newReverseCount % 2 === 1;

    await db
      .update(gameRounds)
      .set({
        reverseCount: newReverseCount,
        isReversed,
        updatedAt: new Date(),
      })
      .where(eq(gameRounds.id, roundId));

    broadcastToAll('round:reverse_played', {
      roundId,
      reverseCount: newReverseCount,
      isReversed,
    });
  }

  // Atomically mark one available card as used
  const cardToConsume = availableCards[0];
  await db
    .update(teamCards)
    .set({ usedInRoundId: roundId })
    .where(eq(teamCards.id, cardToConsume.id));

  // Insert play record
  const [play] = await db
    .insert(roundCardPlays)
    .values({
      roundId,
      teamId,
      cardType,
      phase: currentPhase,
      metadata: metadataObj ? JSON.stringify(metadataObj) : null,
    })
    .returning();

  broadcastToAdmins('round:card_played', {
    roundId,
    teamId,
    cardType,
    metadata: metadataObj,
  });

  return { play, metadata: metadataObj };
}

export async function submitPick(
  db: Db,
  params: {
    roundId: string;
    teamId: string;
    pick: number;
  },
) {
  const { roundId, teamId, pick } = params;

  if (!Number.isInteger(pick) || pick < 1 || pick > 100) {
    throw badRequest('Pick must be an integer between 1 and 100');
  }

  const [round] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  if (!round) throw notFound('Round not found');
  if (round.status !== 'SELECTION') {
    throw conflict(`Cannot submit pick while round is in state ${round.status}`);
  }

  // Check if number was reserved by another team
  const reservedPlay = await db
    .select()
    .from(roundCardPlays)
    .where(
      and(
        eq(roundCardPlays.roundId, roundId),
        eq(roundCardPlays.cardType, 'RESERVE'),
      ),
    )
    .limit(1);

  if (reservedPlay.length > 0 && reservedPlay[0].teamId !== teamId) {
    let reservedNum: number | undefined;
    try {
      const meta = JSON.parse(reservedPlay[0].metadata ?? '{}');
      reservedNum = meta.reservedNumber;
    } catch {
      // ignore json parse error
    }
    if (reservedNum === pick) {
      throw conflict(`Number ${pick} has been reserved by another team.`);
    }
  }

  // Check if team already locked a pick
  const [existing] = await db
    .select()
    .from(roundPicks)
    .where(and(eq(roundPicks.roundId, roundId), eq(roundPicks.teamId, teamId)))
    .limit(1);

  if (existing) {
    throw conflict('A pick has already been locked in and cannot be changed.');
  }

  const [newPick] = await db
    .insert(roundPicks)
    .values({
      roundId,
      teamId,
      pick,
      isLocked: true,
      isReservePick: false,
    })
    .returning();

  broadcastToAdmins('round:team_pick', {
    roundId,
    teamId,
    pick,
    receivedAt: newPick.receivedAt,
  });

  return newPick;
}

export async function resolveAndScoreRound(db: Db, roundId: string) {
  const [round] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  if (!round) throw notFound('Round not found');
  if (round.status === 'RESULT') {
    throw conflict('Round has already been resolved and scored.');
  }
  if (round.status === 'ABORTED') {
    throw conflict('Cannot score an aborted round.');
  }

  const allTeams = await db.select().from(teams);
  const allTeamIds = allTeams.map((t) => t.id);

  const picks = await db
    .select()
    .from(roundPicks)
    .where(eq(roundPicks.roundId, roundId));

  const cardPlaysRaw = await db
    .select()
    .from(roundCardPlays)
    .where(eq(roundCardPlays.roundId, roundId));

  const currentScores = await getTeamScoresMap(db, round.eventId);

  const [rules] = await db
    .select()
    .from(eventRules)
    .where(eq(eventRules.eventId, round.eventId))
    .limit(1);

  const engineConfig: EngineRuleConfig = {
    clashPenaltyMode: rules?.clashPenaltyMode ?? 'TWO_THIRDS_OF_PICK',
    clashPenaltyX: rules?.clashPenaltyX ?? undefined,
    majorityPenaltyMode: rules?.majorityPenaltyMode ?? 'HALF_ABS_DISTANCE',
    majorityPenaltyX: rules?.majorityPenaltyX ?? undefined,
    shieldCoversClash: rules?.shieldCoversClash ?? true,
    shieldCoversMajority: rules?.shieldCoversMajority ?? true,
    shieldCoversReversedMinority: rules?.shieldCoversReversedMinority ?? true,
    stdDevMode: rules?.stdDevMode ?? 'POPULATION',
    sampleStdDevForSingleValue: rules?.sampleStdDevForSingleValue ?? 'ZERO',
    equalityMode: rules?.equalityMode ?? 'EXACT',
    equalityEpsilon: rules?.equalityEpsilon ?? undefined,
    displayRounding: rules?.displayRounding ?? 'HALF_UP',
    scoreMultiplier: round.scoreMultiplier ?? 1,
  };

  const cardPlays = cardPlaysRaw.map((p) => {
    let metadata: Record<string, unknown> | undefined;
    try {
      if (p.metadata) metadata = JSON.parse(p.metadata);
    } catch {
      // ignore
    }
    return {
      teamId: p.teamId,
      card: p.cardType,
      phase: p.phase as 'LOBBY' | 'SELECTION',
      metadata,
    };
  });

  const scoringResult = scoreRound({
    statCard: round.statCard,
    picks: picks.map((p) => ({ teamId: p.teamId, pick: p.pick })),
    allTeamIds,
    currentScores,
    cardPlays,
    config: engineConfig,
  });

  // Database transaction for atomic ledger commits and round completion
  await db.transaction(async (tx) => {
    // 1. Update round record
    await tx
      .update(gameRounds)
      .set({
        status: 'RESULT',
        targetValue: scoringResult.target,
        displayTarget: scoringResult.displayTarget,
        isDegenerate: scoringResult.isDegenerate,
        reverseCount: scoringResult.reverseCount,
        isReversed: scoringResult.isReversed,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gameRounds.id, roundId));

    // 2. Insert ledger entries if not practice round
    if (!round.isPractice) {
      for (const delta of scoringResult.deltas) {
        const teamStart = new Decimal(currentScores[delta.teamId] ?? '0');
        const teamDelta = new Decimal(delta.delta);
        const balanceAfter = teamStart.plus(teamDelta);

        await tx.insert(scoreLedger).values({
          eventId: round.eventId,
          roundId: round.id,
          teamId: delta.teamId,
          component: delta.component,
          pointsDelta: delta.delta,
          balanceAfter: balanceAfter.toString(),
          reason: delta.details ?? `Round ${round.roundNumber} ${delta.component}`,
        });
      }
    }
  });

  broadcastToAll('round:result', {
    roundId: round.id,
    roundNumber: round.roundNumber,
    target: scoringResult.target,
    displayTarget: scoringResult.displayTarget,
    isDegenerate: scoringResult.isDegenerate,
    majorityBucket: scoringResult.majorityBucket,
    isReversed: scoringResult.isReversed,
    reverseCount: scoringResult.reverseCount,
  });

  broadcastToAll('leaderboard:update', {
    eventId: round.eventId,
    roundId: round.id,
  });

  return scoringResult;
}

export async function extendRoundTimer(
  db: Db,
  params: {
    roundId: string;
    additionalSeconds: number;
    adminUserId?: string;
  },
) {
  const { roundId, additionalSeconds, adminUserId } = params;

  const [round] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  if (!round) throw notFound('Round not found');
  if (round.status !== 'LOBBY' && round.status !== 'SELECTION') {
    throw conflict(`Cannot extend timer for round in state ${round.status}`);
  }

  const updates: Partial<typeof gameRounds.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (round.status === 'LOBBY') {
    updates.lobbySeconds = round.lobbySeconds + additionalSeconds;
  } else {
    updates.selectionSeconds = round.selectionSeconds + additionalSeconds;
  }

  const [updated] = await db
    .update(gameRounds)
    .set(updates)
    .where(eq(gameRounds.id, roundId))
    .returning();

  await db.insert(roundAuditLogs).values({
    eventId: round.eventId,
    roundId: round.id,
    action: 'EXTEND_TIMER',
    adminUserId,
    details: `Extended timer by ${additionalSeconds} seconds in phase ${round.status}`,
  });

  broadcastToAll('round:timer_extended', {
    roundId: updated.id,
    status: updated.status,
    lobbySeconds: updated.lobbySeconds,
    selectionSeconds: updated.selectionSeconds,
  });

  return updated;
}

export async function voidRound(
  db: Db,
  params: {
    roundId: string;
    reason: string;
    adminUserId?: string;
  },
) {
  const { roundId, reason, adminUserId } = params;

  const [round] = await db
    .select()
    .from(gameRounds)
    .where(eq(gameRounds.id, roundId))
    .limit(1);

  if (!round) throw notFound('Round not found');

  await db.transaction(async (tx) => {
    // Mark round as ABORTED
    await tx
      .update(gameRounds)
      .set({
        status: 'ABORTED',
        updatedAt: new Date(),
      })
      .where(eq(gameRounds.id, roundId));

    // Release any consumed cards from this round so teams get them back
    await tx
      .update(teamCards)
      .set({ usedInRoundId: null })
      .where(eq(teamCards.usedInRoundId, roundId));

    // Delete any ledger entries created for this round
    await tx.delete(scoreLedger).where(eq(scoreLedger.roundId, roundId));

    // Insert audit log
    await tx.insert(roundAuditLogs).values({
      eventId: round.eventId,
      roundId: round.id,
      action: 'VOID_ROUND',
      adminUserId,
      details: reason,
    });
  });

  broadcastToAll('round:voided', {
    roundId,
    reason,
  });

  broadcastToAll('leaderboard:update', {
    eventId: round.eventId,
    voidedRoundId: roundId,
  });

  return { success: true };
}

export async function getTeamRoundView(
  db: Db,
  params: {
    roundId?: string;
    teamId: string;
  },
) {
  const { teamId } = params;
  const evt = await getActiveEvent(db);

  let round = null;
  if (params.roundId) {
    const [r] = await db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.id, params.roundId))
      .limit(1);
    round = r;
  } else {
    round = await getCurrentRound(db, evt.id);
  }

  if (!round) {
    return { active: false, round: null };
  }

  // Get own palette
  const [paletteRow] = await db
    .select()
    .from(roundPalettes)
    .where(
      and(
        eq(roundPalettes.roundId, round.id),
        eq(roundPalettes.teamId, teamId),
      ),
    )
    .limit(1);

  let myPalette: number[] = [];
  if (paletteRow?.paletteNumbers) {
    try {
      myPalette = JSON.parse(paletteRow.paletteNumbers);
    } catch {
      // fallback
    }
  }

  // Get own pick
  const [myPickRow] = await db
    .select()
    .from(roundPicks)
    .where(and(eq(roundPicks.roundId, round.id), eq(roundPicks.teamId, teamId)))
    .limit(1);

  // Get own card played
  const [myCardPlay] = await db
    .select()
    .from(roundCardPlays)
    .where(
      and(
        eq(roundCardPlays.roundId, round.id),
        eq(roundCardPlays.teamId, teamId),
      ),
    )
    .limit(1);

  let cardMetadata: Record<string, unknown> | null = null;
  if (myCardPlay?.metadata) {
    try {
      cardMetadata = JSON.parse(myCardPlay.metadata);
    } catch {
      // ignore
    }
  }

  // Get reserved numbers in round (without team IDs)
  const reservePlays = await db
    .select()
    .from(roundCardPlays)
    .where(
      and(
        eq(roundCardPlays.roundId, round.id),
        eq(roundCardPlays.cardType, 'RESERVE'),
      ),
    );

  const reservedNumbers: number[] = [];
  for (const rp of reservePlays) {
    try {
      const meta = JSON.parse(rp.metadata ?? '{}');
      if (meta.reservedNumber) reservedNumbers.push(meta.reservedNumber);
    } catch {
      // ignore
    }
  }

  // Available inventory cards
  const availableCards = await db
    .select()
    .from(teamCards)
    .where(and(eq(teamCards.teamId, teamId), isNull(teamCards.usedInRoundId)));

  const inventorySummary: Record<PowerUpCard, number> = {
    SHIELD: 0,
    RESERVE: 0,
    PEEK: 0,
    REVERSE: 0,
  };
  for (const c of availableCards) {
    inventorySummary[c.cardType]++;
  }

  // Current cumulative score
  const scoreMap = await getTeamScoresMap(db, evt.id);
  const currentScore = scoreMap[teamId] ?? '100';

  // Result info if round ended
  let resultInfo: Record<string, unknown> | null = null;
  if (round.status === 'RESULT') {
    const roundPicksList = await db
      .select({
        teamId: roundPicks.teamId,
        teamName: teams.name,
        pick: roundPicks.pick,
      })
      .from(roundPicks)
      .innerJoin(teams, eq(roundPicks.teamId, teams.id))
      .where(eq(roundPicks.roundId, round.id));

    const ledgerEntries = await db
      .select()
      .from(scoreLedger)
      .where(
        and(eq(scoreLedger.roundId, round.id), eq(scoreLedger.teamId, teamId)),
      );

    resultInfo = {
      target: round.targetValue,
      displayTarget: round.displayTarget,
      isDegenerate: round.isDegenerate,
      isReversed: round.isReversed,
      reverseCount: round.reverseCount,
      ledgerEntries,
      // Public reveal of picks after round ends per OPEN-029
      revealedPicks: roundPicksList,
    };
  }

  return {
    active: true,
    round: {
      id: round.id,
      roundNumber: round.roundNumber,
      statCard: round.statCard,
      status: round.status,
      lobbySeconds: round.lobbySeconds,
      selectionSeconds: round.selectionSeconds,
      lobbyStartedAt: round.lobbyStartedAt,
      selectionStartedAt: round.selectionStartedAt,
      closedAt: round.closedAt,
      isReversed: round.isReversed,
      reverseCount: round.reverseCount,
      scoreMultiplier: round.scoreMultiplier,
    },
    myPick: myPickRow ? { pick: myPickRow.pick, isLocked: myPickRow.isLocked } : null,
    myCardPlayed: myCardPlay
      ? { cardType: myCardPlay.cardType, phase: myCardPlay.phase, metadata: cardMetadata }
      : null,
    myPalette,
    reservedNumbers,
    currentScore,
    inventory: inventorySummary,
    result: resultInfo,
  };
}

export async function getAdminRoundState(db: Db, roundId?: string) {
  const evt = await getActiveEvent(db);

  let round = null;
  if (roundId) {
    const [r] = await db
      .select()
      .from(gameRounds)
      .where(eq(gameRounds.id, roundId))
      .limit(1);
    round = r;
  } else {
    round = await getCurrentRound(db, evt.id);
  }

  if (!round) {
    return { active: false, round: null };
  }

  const allTeams = await db.select().from(teams);
  const picks = await db
    .select()
    .from(roundPicks)
    .where(eq(roundPicks.roundId, round.id));

  const cardPlays = await db
    .select()
    .from(roundCardPlays)
    .where(eq(roundCardPlays.roundId, round.id));

  const scoreMap = await getTeamScoresMap(db, evt.id);

  const teamSubmissions = allTeams.map((t) => {
    const pickRow = picks.find((p) => p.teamId === t.id);
    const cardRow = cardPlays.find((c) => c.teamId === t.id);
    return {
      teamId: t.id,
      teamName: t.name,
      tag: t.tag,
      pick: pickRow?.pick ?? null,
      isLocked: pickRow?.isLocked ?? false,
      isReservePick: pickRow?.isReservePick ?? false,
      receivedAt: pickRow?.receivedAt ?? null,
      cardPlayed: cardRow?.cardType ?? null,
      currentScore: scoreMap[t.id] ?? '100',
    };
  });

  return {
    active: true,
    round: {
      id: round.id,
      roundNumber: round.roundNumber,
      statCard: round.statCard,
      status: round.status,
      lobbySeconds: round.lobbySeconds,
      selectionSeconds: round.selectionSeconds,
      lobbyStartedAt: round.lobbyStartedAt,
      selectionStartedAt: round.selectionStartedAt,
      closedAt: round.closedAt,
      targetValue: round.targetValue,
      displayTarget: round.displayTarget,
      isDegenerate: round.isDegenerate,
      isPractice: round.isPractice,
      scoreMultiplier: round.scoreMultiplier,
      reverseCount: round.reverseCount,
      isReversed: round.isReversed,
    },
    submissions: teamSubmissions,
  };
}

export async function getLeaderboard(db: Db, eventId: string) {
  const allTeams = await db.select().from(teams);
  const scoreMap = await getTeamScoresMap(db, eventId);

  // Tiebreaker 1: rounds with net gain (pointsDelta > 0)
  const ledgerRows = await db
    .select()
    .from(scoreLedger)
    .where(eq(scoreLedger.eventId, eventId));

  const positiveRoundsCount: Record<string, number> = {};
  for (const t of allTeams) {
    positiveRoundsCount[t.id] = 0;
  }

  // Group by roundId and teamId to check net gain per round
  const roundTeamDeltas = new Map<string, Decimal>();
  for (const row of ledgerRows) {
    if (!row.roundId) continue;
    const key = `${row.roundId}:${row.teamId}`;
    const curr = roundTeamDeltas.get(key) ?? new Decimal(0);
    roundTeamDeltas.set(key, curr.plus(new Decimal(row.pointsDelta)));
  }

  for (const [key, netDelta] of roundTeamDeltas.entries()) {
    const [, teamId] = key.split(':');
    if (netDelta.gt(0)) {
      positiveRoundsCount[teamId] = (positiveRoundsCount[teamId] ?? 0) + 1;
    }
  }

  // Tiebreaker 2: power-up cards held
  const cards = await db
    .select({
      teamId: teamCards.teamId,
      count: sql<number>`count(*)::int`,
    })
    .from(teamCards)
    .where(and(eq(teamCards.eventId, eventId), isNull(teamCards.usedInRoundId)))
    .groupBy(teamCards.teamId);

  const cardsHeldMap: Record<string, number> = {};
  for (const c of cards) {
    cardsHeldMap[c.teamId] = Number(c.count) || 0;
  }

  const rankedTeams = allTeams.map((t) => {
    const rawScore = scoreMap[t.id] ?? '100';
    return {
      teamId: t.id,
      name: t.name,
      tag: t.tag,
      rawScore,
      displayScore: formatScore(rawScore),
      positiveRounds: positiveRoundsCount[t.id] ?? 0,
      cardsHeld: cardsHeldMap[t.id] ?? 0,
    };
  });

  // Sort descending:
  // 1) rawScore
  // 2) positiveRounds
  // 3) cardsHeld
  rankedTeams.sort((a, b) => {
    const scoreDiff = new Decimal(b.rawScore).minus(new Decimal(a.rawScore));
    if (!scoreDiff.isZero()) return scoreDiff.isPositive() ? 1 : -1;

    if (b.positiveRounds !== a.positiveRounds) {
      return b.positiveRounds - a.positiveRounds;
    }

    return b.cardsHeld - a.cardsHeld;
  });

  // Assign ranks with shared rank support
  let currentRank = 1;
  const entriesWithRank = rankedTeams.map((team, idx) => {
    if (idx > 0) {
      const prev = rankedTeams[idx - 1];
      const sameScore = new Decimal(team.rawScore).equals(new Decimal(prev.rawScore));
      const samePosRounds = team.positiveRounds === prev.positiveRounds;
      const sameCards = team.cardsHeld === prev.cardsHeld;
      if (!sameScore || !samePosRounds || !sameCards) {
        currentRank = idx + 1;
      }
    }
    return {
      rank: currentRank,
      ...team,
    };
  });

  return entriesWithRank;
}
