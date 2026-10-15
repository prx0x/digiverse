import type { AppConfig } from './config.js';
import type { Db } from './db/client.js';
import type { AuthUser } from './services/sessions.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: Db;
  }

  interface FastifyRequest {
    authUser: AuthUser | null;
    sessionToken: string | null;
  }
}
