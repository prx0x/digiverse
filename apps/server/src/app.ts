import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { AppConfig } from './config.js';
import type { Db } from './db/client.js';
import { AppError } from './lib/errors.js';
import { attachAuth, ensureCsrfCookie } from './plugins/auth.js';
import { adminEventRoutes } from './routes/adminEvent.js';
import { adminTeamRoutes } from './routes/adminTeams.js';
import { authRoutes } from './routes/auth.js';
import { gameRoundRoutes } from './routes/gameRounds.js';
import { healthRoutes } from './routes/health.js';
import { rapidFireRoutes } from './routes/rapidFire.js';
import { teamRoutes } from './routes/teams.js';
import { registerClient } from './services/realtime.js';
import './types.js';

export type BuildAppOptions = {
  config: AppConfig;
  db: Db;
};

export async function buildApp({ config, db }: BuildAppOptions) {
  const app = Fastify({
    logger: true,
    trustProxy: true
  });

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorateRequest('authUser', null);
  app.decorateRequest('sessionToken', null);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (config.NODE_ENV !== 'production') {
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (isLocal) {
          cb(null, true);
          return;
        }
      }
      cb(null, config.corsOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['set-cookie'],
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  await app.register(rateLimit, {
    global: false,
  });

  app.addHook('onRequest', async (request, reply) => {
    await attachAuth(request);
    ensureCsrfCookie(request, reply);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode) || 500;
      if (statusCode === 429) {
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
          },
        });
      }
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL',
        message: 'Internal server error',
      },
    });
  });

  await app.register(websocket);

  app.get('/ws', { websocket: true }, (socket, req) => {
    if (!req.authUser) {
      socket.close(4401, 'Unauthorized');
      return;
    }
    const unregister = registerClient(socket, req.authUser);
    socket.on('close', () => {
      unregister();
    });
    socket.on('message', (data: { toString(): string }) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {
        // ignore malformed message
      }
    });
  });

  await app.register(healthRoutes);
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes);
      await api.register(adminTeamRoutes);
      await api.register(adminEventRoutes);
      await api.register(teamRoutes);
      await api.register(rapidFireRoutes);
      await api.register(gameRoundRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
