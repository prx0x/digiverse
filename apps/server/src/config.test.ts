import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const baseValidEnv: NodeJS.ProcessEnv = {
    DATABASE_URL: 'postgresql://digiverse:digiverse@localhost:5432/digiverse',
    ADMIN_BOOTSTRAP_USER_ID: 'admin',
    ADMIN_BOOTSTRAP_PASSWORD: 'SuperSecretAdminPassword123!',
    SESSION_SECRET: '0123456789012345678901234567890123456789',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173, http://127.0.0.1:5173',
  };

  it('loads valid configuration with defaults', () => {
    const config = loadConfig(baseValidEnv);
    expect(config.APP_NAME).toBe('Digiverse');
    expect(config.PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.COOKIE_SECURE).toBe(false);
    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
    expect(config.sessionCookieName).toBe('digiverse_session');
    expect(config.csrfCookieName).toBe('digiverse_csrf');
  });

  it('fails fast when required variables are missing', () => {
    expect(() => loadConfig({})).toThrow(/Invalid environment configuration/);
  });

  it('fails fast when admin password is too short', () => {
    expect(() =>
      loadConfig({
        ...baseValidEnv,
        ADMIN_BOOTSTRAP_PASSWORD: 'short',
      }),
    ).toThrow(/ADMIN_BOOTSTRAP_PASSWORD/);
  });

  it('fails fast when session secret is less than 32 characters', () => {
    expect(() =>
      loadConfig({
        ...baseValidEnv,
        SESSION_SECRET: 'too-short-secret',
      }),
    ).toThrow(/SESSION_SECRET/);
  });
});
