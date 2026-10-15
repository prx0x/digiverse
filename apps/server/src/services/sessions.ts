import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { sessions, teams, users, type User } from '../db/schema.js';
import { createSessionToken, hashToken } from '../lib/tokens.js';
import type { AppConfig } from '../config.js';

export type AuthUser = {
  id: string;
  identifier: string;
  role: 'admin' | 'team';
  enabled: boolean;
  team: { id: string; name: string; tag: string | null } | null;
};

export async function createSession(
  db: Db,
  config: AppConfig,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}

export async function revokeAllUserSessions(db: Db, userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function resolveSession(
  db: Db,
  token: string | undefined,
): Promise<{ user: AuthUser; sessionId: string } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = new Date();

  const row = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, tokenHash),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
    ),
    with: {
      user: {
        with: { team: true },
      },
    },
  });

  if (!row || !row.user.enabled) return null;

  return {
    sessionId: row.id,
    user: toAuthUser(row.user),
  };
}

export function toAuthUser(
  user: User & { team?: { id: string; name: string; tag: string | null } | null },
): AuthUser {
  return {
    id: user.id,
    identifier: user.identifier,
    role: user.role,
    enabled: user.enabled,
    team: user.team
      ? { id: user.team.id, name: user.team.name, tag: user.team.tag }
      : null,
  };
}

export async function findUserByIdentifier(db: Db, identifier: string) {
  return db.query.users.findFirst({
    where: eq(users.identifier, identifier),
    with: { team: true },
  });
}

export async function getTeamForUser(db: Db, userId: string) {
  return db.query.teams.findFirst({
    where: eq(teams.userId, userId),
  });
}
