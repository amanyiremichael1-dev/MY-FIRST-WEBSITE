import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export type UserRole = 'Administrator' | 'Registration Officer' | 'School Staff';

export interface SessionPayload {
  userId: number;
  username: string;
  role: UserRole;
  exp: number;
}

export interface AuthenticatedUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  is_active: number;
  must_change_password: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signToken(user: { user_id: number; username: string; role: UserRole }): string {
  const payload: SessionPayload = {
    userId: user.user_id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function requireCsrfHeader(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const xRequestedWith = req.header('X-Requested-With');
    const origin = req.header('Origin');
    const host = req.header('X-Forwarded-Host') || req.header('Host');

    if (xRequestedWith !== 'XMLHttpRequest') {
      res.status(403).json({ error: 'Missing required security request header.' });
      return;
    }
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: 'Cross-origin mutation rejected.' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Invalid request origin.' });
        return;
      }
    }
  }
  next();
}
