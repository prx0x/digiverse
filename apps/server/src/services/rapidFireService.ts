import { and, desc, eq, sql } from 'drizzle-orm';
import {
  allocateRapidFireAwards,
  evaluateAnswer,
  type PowerUpCard,
  type RapidFireAdminAward,
  type RapidFireAdminState,
  type RapidFireAdminSubmission,
  type RapidFireTeamView,
  type TeamCardItem,
} from '@digiverse/shared';
import type { Db } from '../db/client.js';
import {
  cardSupply,
  eventRules,
  events,
  questions,
  rapidFireAwards,
  rapidFireSessions,
  rapidFireSubmissions,
  teamCards,
  teams,
} from '../db/schema.js';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { broadcastToAdmins, broadcastToAll } from './realtime.js';

export async function getActiveEvent(db: Db, explicitEventId?: string) {
  if (explicitEventId) {
    const [evt] = await db.select().from(events).where(eq(events.id, explicitEventId)).limit(1);
    if (!evt) throw notFound('Event not found');
    return evt;
  }

  const [evt] = await db.select().from(events).orderBy(desc(events.createdAt)).limit(1);
  if (!evt) throw notFound('No event configured');
  return evt;
}

export async function getCardSupplyRemaining(db: Db, eventId: string): Promise<Record<PowerUpCard, number>> {
  const supplies = await db.select().from(cardSupply).where(eq(cardSupply.eventId, eventId));
  const counts = await db
    .select({
      cardType: teamCards.cardType,
      count: sql<number>`count(*)::int`,
    })
    .from(teamCards)
    .where(eq(teamCards.eventId, eventId))
    .groupBy(teamCards.cardType);

  const awardedMap = new Map<string, number>();
  for (const c of counts) {
    awardedMap.set(c.cardType, Number(c.count) || 0);
  }

  const result: Record<PowerUpCard, number> = {
    SHIELD: 0,
    RESERVE: 0,
    PEEK: 0,
    REVERSE: 0,
  };

  for (const s of supplies) {
    const awarded = awardedMap.get(s.cardType) ?? 0;
    result[s.cardType] = Math.max(0, s.maxSupply - awarded);
  }

  return result;
}

export async function startRapidFireQuestion(
  db: Db,
  { eventId, questionId }: { eventId: string; questionId: string },
) {
  const evt = await getActiveEvent(db, eventId);
  if (evt.status !== 'LIVE' && evt.status !== 'READY') {
    throw conflict(`Cannot start rapid fire while event is ${evt.status}`);
  }

  // Check if a question is already open
  const [openSession] = await db
    .select()
    .from(rapidFireSessions)
    .where(and(eq(rapidFireSessions.eventId, evt.id), eq(rapidFireSessions.status, 'QUESTION_OPEN')))
    .limit(1);

  if (openSession) {
    throw conflict('A rapid fire question is already open. Close or award it before starting another.');
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) throw notFound('Question not found');

  // If question awards a card, check that remaining supply is available
  if (question.mappedCard) {
    const supplyRemaining = await getCardSupplyRemaining(db, evt.id);
    if ((supplyRemaining[question.mappedCard] ?? 0) <= 0) {
      throw badRequest(`Card supply for ${question.mappedCard} is already exhausted`);
    }
  }

  const now = new Date();
  const [session] = await db
    .insert(rapidFireSessions)
    .values({
      eventId: evt.id,
      questionId: question.id,
      status: 'QUESTION_OPEN',
      openedAt: now,
      timeLimitSeconds: question.timeLimitSeconds,
    })
    .returning();

  broadcastToAll('rapidfire:opened', {
    sessionId: session.id,
    questionId: question.id,
    prompt: question.prompt,
    timeLimitSeconds: question.timeLimitSeconds,
    openedAt: now.toISOString(),
    mappedCard: question.mappedCard,
    topN: question.topN,
  });

  return session;
}

export async function closeRapidFireQuestion(
  db: Db,
  { eventId, sessionId }: { eventId: string; sessionId?: string },
) {
  const evt = await getActiveEvent(db, eventId);

  let session;
  if (sessionId) {
    [session] = await db
      .select()
      .from(rapidFireSessions)
      .where(and(eq(rapidFireSessions.id, sessionId), eq(rapidFireSessions.eventId, evt.id)))
      .limit(1);
  } else {
    [session] = await db
      .select()
      .from(rapidFireSessions)
      .where(and(eq(rapidFireSessions.eventId, evt.id), eq(rapidFireSessions.status, 'QUESTION_OPEN')))
      .limit(1);
  }

  if (!session) throw notFound('No active open question found');

  const [updated] = await db
    .update(rapidFireSessions)
    .set({
      status: 'CLOSED',
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rapidFireSessions.id, session.id))
    .returning();

  broadcastToAll('rapidfire:closed', {
    sessionId: updated.id,
    closedAt: updated.closedAt?.toISOString(),
  });

  return updated;
}

export async function awardRapidFireQuestion(
  db: Db,
  { eventId, sessionId }: { eventId: string; sessionId?: string },
) {
  const evt = await getActiveEvent(db, eventId);

  let session;
  if (sessionId) {
    [session] = await db
      .select()
      .from(rapidFireSessions)
      .where(and(eq(rapidFireSessions.id, sessionId), eq(rapidFireSessions.eventId, evt.id)))
      .limit(1);
  } else {
    [session] = await db
      .select()
      .from(rapidFireSessions)
      .where(eq(rapidFireSessions.eventId, evt.id))
      .orderBy(desc(rapidFireSessions.createdAt))
      .limit(1);
  }

  if (!session) throw notFound('No rapid fire session found');

  if (session.status === 'AWARDED') {
    // Return existing awards
    const existingAwards = await db
      .select()
      .from(rapidFireAwards)
      .where(eq(rapidFireAwards.sessionId, session.id));
    return existingAwards;
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, session.questionId))
    .limit(1);

  if (!question) throw notFound('Question not found');

  const [rules] = await db
    .select()
    .from(eventRules)
    .where(eq(eventRules.eventId, evt.id))
    .limit(1);

  const submissions = await db
    .select()
    .from(rapidFireSubmissions)
    .where(eq(rapidFireSubmissions.sessionId, session.id));

  const remainingSupply = question.mappedCard
    ? (await getCardSupplyRemaining(db, evt.id))[question.mappedCard] ?? 0
    : 0;

  const allocations = allocateRapidFireAwards({
    submissions,
    topN: question.topN,
    mappedCard: question.mappedCard,
    availableSupply: remainingSupply,
    tieBreak: rules?.rapidFireTieBreak ?? 'EARLIEST_RECEIVED_THEN_ID',
  });

  const now = new Date();

  await db.transaction(async (tx) => {
    for (const alloc of allocations) {
      await tx.insert(rapidFireAwards).values({
        sessionId: session.id,
        teamId: alloc.teamId,
        cardType: alloc.cardType,
        rank: alloc.rank,
        receivedAt: new Date(alloc.receivedAt),
        reason: alloc.reason,
        createdAt: now,
      });

      await tx.insert(teamCards).values({
        eventId: evt.id,
        teamId: alloc.teamId,
        cardType: alloc.cardType,
        acquiredFrom: 'RAPID_FIRE',
        questionId: question.id,
        createdAt: now,
      });
    }

    await tx
      .update(rapidFireSessions)
      .set({
        status: 'AWARDED',
        closedAt: session.closedAt ?? now,
        awardedAt: now,
        updatedAt: now,
      })
      .where(eq(rapidFireSessions.id, session.id));
  });

  broadcastToAll('rapidfire:awarded', {
    sessionId: session.id,
    questionId: question.id,
    allocations,
  });

  broadcastToAll('leaderboard:update', {
    eventId: evt.id,
  });

  return allocations;
}

export async function submitRapidFireAnswer(
  db: Db,
  {
    teamId,
    eventId,
    questionId,
    rawAnswer,
  }: {
    teamId: string;
    eventId: string;
    questionId: string;
    rawAnswer: string;
  },
) {
  const evt = await getActiveEvent(db, eventId);

  const [session] = await db
    .select()
    .from(rapidFireSessions)
    .where(
      and(
        eq(rapidFireSessions.eventId, evt.id),
        eq(rapidFireSessions.questionId, questionId),
        eq(rapidFireSessions.status, 'QUESTION_OPEN'),
      ),
    )
    .limit(1);

  if (!session) {
    throw new AppError(400, 'QUESTION_CLOSED', 'Question is not currently open for submissions');
  }

  // Check server-side time expiration with a 2-second grace period for transit
  const now = new Date();
  if (session.openedAt) {
    const elapsedSeconds = (now.getTime() - session.openedAt.getTime()) / 1000;
    if (elapsedSeconds > session.timeLimitSeconds + 2) {
      throw new AppError(400, 'QUESTION_CLOSED', 'Time limit expired');
    }
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) throw notFound('Question not found');

  const [rules] = await db
    .select()
    .from(eventRules)
    .where(eq(eventRules.eventId, evt.id))
    .limit(1);

  const maxAttempts = rules?.rapidFireMaxAttempts ?? 1;

  const existing = await db
    .select()
    .from(rapidFireSubmissions)
    .where(
      and(
        eq(rapidFireSubmissions.sessionId, session.id),
        eq(rapidFireSubmissions.teamId, teamId),
      ),
    );

  if (existing.length >= maxAttempts) {
    throw new AppError(400, 'ATTEMPTS_EXCEEDED', `Maximum attempts (${maxAttempts}) reached for this question`);
  }

  const isCorrect = evaluateAnswer(
    rawAnswer,
    question.answerDefinition,
    question.matchingMode,
    question.questionType,
    question.options,
  );

  const [sub] = await db
    .insert(rapidFireSubmissions)
    .values({
      sessionId: session.id,
      teamId,
      rawAnswer,
      isCorrect,
      attemptNumber: existing.length + 1,
      receivedAt: now,
    })
    .returning();

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

  broadcastToAdmins('rapidfire:submission', {
    submissionId: sub.id,
    teamId,
    teamName: team?.name ?? 'Unknown Team',
    receivedAt: now.toISOString(),
    isCorrect,
    attemptNumber: sub.attemptNumber,
    rawAnswer,
  });

  return {
    submitted: true,
    receivedAt: now.toISOString(),
    attemptNumber: sub.attemptNumber,
    isCorrect,
  };
}

export async function getRapidFireTeamView(
  db: Db,
  { eventId, teamId }: { eventId: string; teamId: string },
): Promise<RapidFireTeamView> {
  const evt = await getActiveEvent(db, eventId);

  const [session] = await db
    .select()
    .from(rapidFireSessions)
    .where(eq(rapidFireSessions.eventId, evt.id))
    .orderBy(desc(rapidFireSessions.createdAt))
    .limit(1);

  if (!session) {
    return {
      status: 'IDLE',
      question: null,
      teamSubmission: {
        submitted: false,
        attemptCount: 0,
        maxAttempts: 1,
        canSubmit: false,
        lastReceivedAt: null,
      },
      award: null,
    };
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, session.questionId))
    .limit(1);

  const [rules] = await db
    .select()
    .from(eventRules)
    .where(eq(eventRules.eventId, evt.id))
    .limit(1);

  const maxAttempts = rules?.rapidFireMaxAttempts ?? 1;

  const existingSubs = await db
    .select()
    .from(rapidFireSubmissions)
    .where(
      and(
        eq(rapidFireSubmissions.sessionId, session.id),
        eq(rapidFireSubmissions.teamId, teamId),
      ),
    )
    .orderBy(desc(rapidFireSubmissions.receivedAt));

  const attemptCount = existingSubs.length;
  const lastSub = existingSubs[0];

  const now = Date.now();
  const openedTime = session.openedAt ? new Date(session.openedAt).getTime() : now;
  const elapsedSec = Math.floor((now - openedTime) / 1000);
  const remainingSeconds = session.status === 'QUESTION_OPEN'
    ? Math.max(0, session.timeLimitSeconds - elapsedSec)
    : 0;

  const canSubmit =
    session.status === 'QUESTION_OPEN' &&
    attemptCount < maxAttempts &&
    remainingSeconds > 0;

  let award: { won: boolean; cardType: PowerUpCard | null; rank: number | null } | null = null;
  if (session.status === 'AWARDED') {
    const [teamAward] = await db
      .select()
      .from(rapidFireAwards)
      .where(
        and(
          eq(rapidFireAwards.sessionId, session.id),
          eq(rapidFireAwards.teamId, teamId),
        ),
      )
      .limit(1);

    if (teamAward) {
      award = {
        won: true,
        cardType: teamAward.cardType,
        rank: teamAward.rank,
      };
    } else {
      award = {
        won: false,
        cardType: null,
        rank: null,
      };
    }
  }

  return {
    status: session.status,
    question: question
      ? {
          id: question.id,
          prompt: question.prompt,
          timeLimitSeconds: session.timeLimitSeconds,
          openedAt: session.openedAt ? session.openedAt.toISOString() : null,
          remainingSeconds,
          mappedCard: question.mappedCard,
          topN: question.topN,
          questionType: question.questionType,
          options: question.options,
        }
      : null,
    teamSubmission: {
      submitted: attemptCount > 0,
      attemptCount,
      maxAttempts,
      canSubmit,
      lastReceivedAt: lastSub ? lastSub.receivedAt.toISOString() : null,
    },
    award,
  };
}

export async function getRapidFireAdminState(
  db: Db,
  eventId: string,
): Promise<RapidFireAdminState> {
  const evt = await getActiveEvent(db, eventId);

  const [session] = await db
    .select()
    .from(rapidFireSessions)
    .where(eq(rapidFireSessions.eventId, evt.id))
    .orderBy(desc(rapidFireSessions.createdAt))
    .limit(1);

  const remainingSupply = await getCardSupplyRemaining(db, evt.id);

  if (!session) {
    return {
      status: 'IDLE',
      question: null,
      submissions: [],
      awards: [],
      remainingCardSupply: remainingSupply,
    };
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, session.questionId))
    .limit(1);

  const rawSubmissions = await db
    .select({
      id: rapidFireSubmissions.id,
      teamId: rapidFireSubmissions.teamId,
      teamName: teams.name,
      rawAnswer: rapidFireSubmissions.rawAnswer,
      isCorrect: rapidFireSubmissions.isCorrect,
      attemptNumber: rapidFireSubmissions.attemptNumber,
      receivedAt: rapidFireSubmissions.receivedAt,
    })
    .from(rapidFireSubmissions)
    .innerJoin(teams, eq(rapidFireSubmissions.teamId, teams.id))
    .where(eq(rapidFireSubmissions.sessionId, session.id))
    .orderBy(rapidFireSubmissions.receivedAt);

  const rawAwards = await db
    .select({
      teamId: rapidFireAwards.teamId,
      teamName: teams.name,
      cardType: rapidFireAwards.cardType,
      rank: rapidFireAwards.rank,
      receivedAt: rapidFireAwards.receivedAt,
      reason: rapidFireAwards.reason,
    })
    .from(rapidFireAwards)
    .innerJoin(teams, eq(rapidFireAwards.teamId, teams.id))
    .where(eq(rapidFireAwards.sessionId, session.id))
    .orderBy(rapidFireAwards.rank);

  const submissions: RapidFireAdminSubmission[] = rawSubmissions.map((s) => ({
    id: s.id,
    teamId: s.teamId,
    teamName: s.teamName,
    rawAnswer: s.rawAnswer,
    isCorrect: s.isCorrect,
    attemptNumber: s.attemptNumber,
    receivedAt: s.receivedAt.toISOString(),
  }));

  const awards: RapidFireAdminAward[] = rawAwards.map((a) => ({
    teamId: a.teamId,
    teamName: a.teamName,
    cardType: a.cardType,
    rank: a.rank,
    receivedAt: a.receivedAt.toISOString(),
    reason: a.reason,
  }));

  return {
    status: session.status,
    question: question
      ? {
          id: question.id,
          prompt: question.prompt,
          answerDefinition: question.answerDefinition,
          matchingMode: question.matchingMode,
          timeLimitSeconds: session.timeLimitSeconds,
          mappedCard: question.mappedCard,
          topN: question.topN,
          openedAt: session.openedAt ? session.openedAt.toISOString() : null,
          closedAt: session.closedAt ? session.closedAt.toISOString() : null,
          awardedAt: session.awardedAt ? session.awardedAt.toISOString() : null,
          questionType: question.questionType,
          options: question.options,
        }
      : null,
    submissions,
    awards,
    remainingCardSupply: remainingSupply,
  };
}

export async function getTeamInventory(
  db: Db,
  { eventId, teamId }: { eventId: string; teamId: string },
): Promise<TeamCardItem[]> {
  const cards = await db
    .select()
    .from(teamCards)
    .where(and(eq(teamCards.eventId, eventId), eq(teamCards.teamId, teamId)))
    .orderBy(desc(teamCards.createdAt));

  return cards.map((c) => ({
    id: c.id,
    cardType: c.cardType,
    acquiredFrom: c.acquiredFrom,
    createdAt: c.createdAt.toISOString(),
    usedInRoundId: c.usedInRoundId,
  }));
}
