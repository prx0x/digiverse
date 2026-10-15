import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { bootstrapAdmin } from './services/bootstrap.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const { db, sql } = createDb(config);

  await runMigrations(db);
  const bootstrap = await bootstrapAdmin(db, config);
  const app = await buildApp({ config, db });

  const shutdown = async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(
    {
      port: config.PORT,
      adminBootstrapped: bootstrap.created,
    },
    'Digiverse server listening',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
