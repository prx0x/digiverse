import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import type { AppConfig } from '../config.js';

/**
 * Idempotent admin bootstrap from env. Never logs the password.
 */
export async function bootstrapAdmin(db: Db, config: AppConfig): Promise<{ created: boolean }> {
  const identifier = config.ADMIN_BOOTSTRAP_USER_ID;
  const existing = await db.query.users.findFirst({
    where: eq(users.identifier, identifier),
  });

  if (existing) {
    return { created: false };
  }

  const passwordHash = await hashPassword(config.ADMIN_BOOTSTRAP_PASSWORD);
  await db.insert(users).values({
    identifier,
    passwordHash,
    role: 'admin',
    enabled: true,
  });

  return { created: true };
}
