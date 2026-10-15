import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { loadConfig } from '../config.js';
import type { Db } from './client.js';

export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
  await migrate(db, { migrationsFolder });
}

async function main() {
  const config = loadConfig();
  const sql = postgres(config.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);
  await runMigrations(db as unknown as Db);
  await sql.end();
  console.log('Migrations applied.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
