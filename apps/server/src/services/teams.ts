import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { teams, users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { revokeAllUserSessions } from './sessions.js';

export type CreateTeamInput = {
  identifier: string;
  password: string;
  name: string;
  tag?: string;
};

export async function listTeams(db: Db) {
  const rows = await db.query.teams.findMany({
    with: { user: true },
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tag: row.tag,
    identifier: row.user.identifier,
    enabled: row.user.enabled,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createTeam(db: Db, input: CreateTeamInput) {
  if (input.password.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.identifier, input.identifier),
  });
  if (existing) {
    throw conflict('Identifier already in use');
  }

  const passwordHash = await hashPassword(input.password);

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        identifier: input.identifier,
        passwordHash,
        role: 'team',
        enabled: true,
      })
      .returning();

    if (!user) throw badRequest('Failed to create user');

    const [team] = await tx
      .insert(teams)
      .values({
        userId: user.id,
        name: input.name,
        tag: input.tag ?? null,
      })
      .returning();

    if (!team) throw badRequest('Failed to create team');

    return { user, team };
  });

  return {
    id: created.team.id,
    name: created.team.name,
    tag: created.team.tag,
    identifier: created.user.identifier,
    enabled: created.user.enabled,
    createdAt: created.team.createdAt.toISOString(),
  };
}

export async function setTeamEnabled(db: Db, teamId: string, enabled: boolean) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { user: true },
  });
  if (!team) throw notFound('Team not found');

  await db
    .update(users)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(users.id, team.userId));

  if (!enabled) {
    await revokeAllUserSessions(db, team.userId);
  }

  return {
    id: team.id,
    name: team.name,
    tag: team.tag,
    identifier: team.user.identifier,
    enabled,
  };
}

export async function resetTeamPassword(db: Db, teamId: string, password: string) {
  if (password.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });
  if (!team) throw notFound('Team not found');

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, team.userId));

  await revokeAllUserSessions(db, team.userId);

  return { id: team.id, reset: true as const };
}
