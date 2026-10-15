import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { AppConfig } from '../config.js';
import * as schema from './schema.js';

export type Db = ReturnType<typeof createDb>['db'];

export function createDb(config: AppConfig) {
  const sql = postgres(config.DATABASE_URL, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
