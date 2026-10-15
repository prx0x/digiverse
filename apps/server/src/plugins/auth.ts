import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, forbidden, unauthorized } from '../lib/errors.js';
import { safeEqual } from '../lib/password.js';
import { createCsrfToken } from '../lib/tokens.js';
import { resolveSession, type AuthUser } from '../services/sessions.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function attachAuth(request: FastifyRequest): Promise<void> {
  const token = request.cookies[request.server.config.sessionCookieName];
  request.sessionToken = token ?? null;
  const resolved = await resolveSession(request.server.db, token);
  request.authUser = resolved?.user ?? null;
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
): void {
  const config = reply.server.config;
  reply.setCookie(config.sessionCookieName, token, {
    path: '/',
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  const config = reply.server.config;
  reply.clearCookie(config.sessionCookieName, {
    path: '/',
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE,
  });
}

export function ensureCsrfCookie(request: FastifyRequest, reply: FastifyReply): string {
  const config = request.server.config;
  const existing = request.cookies[config.csrfCookieName];
  if (existing) return existing;

  const token = createCsrfToken();
  reply.setCookie(config.csrfCookieName, token, {
    path: '/',
    httpOnly: false,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE,
  });
  return token;
}

export function assertCsrf(request: FastifyRequest): void {
  if (SAFE_METHODS.has(request.method)) return;

  const config = request.server.config;
  const cookieToken = request.cookies[config.csrfCookieName];
  const headerToken = request.headers['x-csrf-token'];
  const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (!cookieToken || !headerValue || !safeEqual(cookieToken, headerValue)) {
    throw new AppError(403, 'CSRF_FAILED', 'Invalid CSRF token');
  }
}

export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  if (!request.authUser) throw unauthorized();
  return request.authUser;
}

export async function requireRole(
  request: FastifyRequest,
  role: 'admin' | 'team',
): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== role) throw forbidden();
  return user;
}
