import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('Digiverse'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  ADMIN_BOOTSTRAP_USER_ID: z.string().min(1),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_LOGIN_WINDOW_SEC: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_ACTIONS_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_ACTIONS_WINDOW_SEC: z.coerce.number().int().positive().default(60),
});

export type AppConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  sessionCookieName: string;
  csrfCookieName: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const data = parsed.data;
  return {
    ...data,
    COOKIE_SECURE: Boolean(data.COOKIE_SECURE),
    corsOrigins: data.CORS_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    sessionCookieName: 'digiverse_session',
    csrfCookieName: 'digiverse_csrf',
  };
}
