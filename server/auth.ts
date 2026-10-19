import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// 관리자 인증: 환경변수의 scrypt 해시로 검증하고, HMAC 서명된 httpOnly 쿠키로 세션을 유지한다.
// 비밀번호는 코드·번들에 없다. 해시 생성: npm run admin:hash -- '비밀번호'

const COOKIE = 'ht_admin';
const SESSION_HOURS = 8;

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split(':');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function secret(): string {
  const s = process.env.SESSION_SECRET ?? '';
  if (s.length < 32) throw new Error('SESSION_SECRET(32자 이상)이 설정되지 않았습니다.');
  return s;
}

export function authConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD_HASH && (process.env.SESSION_SECRET ?? '').length >= 32;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueSession(res: Response, username: string): void {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString('base64url');
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 3600e3,
    path: '/api/admin',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, { path: '/api/admin' });
}

export function readSession(req: Request): { u: string } | null {
  const raw: unknown = req.cookies?.[COOKIE];
  if (typeof raw !== 'string' || !authConfigured()) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; exp: number };
    return data.exp > Date.now() ? { u: data.u } : null;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const s = readSession(req);
  if (!s) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }
  // 상태 변경 요청은 사용자 지정 헤더를 요구해 교차 사이트 요청(CSRF)을 차단 (SameSite=Strict와 이중 방어)
  if (req.method !== 'GET' && req.get('x-requested-with') !== 'hosu-admin') {
    res.status(403).json({ error: '허용되지 않은 요청입니다.' });
    return;
  }
  next();
}

// 로그인 시도 제한 (IP별 15분 10회). 메모리 기반 — 단일 인스턴스 기준
const attempts = new Map<string, { n: number; until: number }>();
export function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.until < now) {
    attempts.set(ip, { n: 1, until: now + 15 * 60e3 });
    return false;
  }
  a.n += 1;
  return a.n > 10;
}
