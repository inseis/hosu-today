import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const dir = mkdtempSync(path.join(tmpdir(), 'hosu-test-'));
process.env.DATA_DIR = dir;
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.ADMIN_USERNAME = 'admin';
process.env.ANALYTICS_ENABLED = 'true';

let server: Server;
let base = '';
let cookie = '';

beforeAll(async () => {
  const { hashPassword } = await import('../server/auth');
  process.env.ADMIN_PASSWORD_HASH = hashPassword('correct-horse-battery');
  const { createApp } = await import('../server/app');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const admin = (p: string, init: RequestInit = {}) =>
  fetch(`${base}/api/admin${p}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'hosu-admin', cookie, ...(init.headers ?? {}) } });

const venueBody = (id: string, extra: Record<string, unknown> = {}) => ({
  venue: {
    id, slug: id, name: `업소 ${id}`, area: 'lafesta', category: '한식', description: null, address: null, addressDetail: null,
    latitude: 37.66, longitude: 126.77, kakaoPlaceId: null, publicPhone: null, coverImage: null, images: [], purposeTags: ['meal'],
    featuredMenus: [], weeklyHours: null, breakTimes: [], temporaryClosures: [], parkingType: 'unknown', parkingFee: null,
    parkingDescription: null, parkingCapacity: null, entranceDescription: null, floor: null, beverages: [], displayOrder: 1,
    isPublished: false, informationVerifiedAt: null, ...extra,
  },
  ops: { consentStatus: 'pending', reviewStatus: 'draft', staffNote: '내부 메모 SECRET', verificationEvidence: '근거 SECRET' },
});

describe('관리자 인증', () => {
  it('비로그인 접근 거부', async () => {
    expect((await fetch(`${base}/api/admin/venues`)).status).toBe(401);
  });
  it('잘못된 비밀번호 거부', async () => {
    const r = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
    expect(r.status).toBe(401);
  });
  it('로그인 → httpOnly 쿠키', async () => {
    const r = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'correct-horse-battery' }) });
    expect(r.status).toBe(200);
    const set = r.headers.get('set-cookie') ?? '';
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Strict/i);
    cookie = set.split(';')[0];
  });
  it('위조 쿠키 거부', async () => {
    const r = await fetch(`${base}/api/admin/venues`, { headers: { cookie: `${cookie.slice(0, -3)}abc` } });
    expect(r.status).toBe(401);
  });
  it('CSRF: 사용자 지정 헤더 없는 변경 요청 거부', async () => {
    const r = await fetch(`${base}/api/admin/venues/a`, { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(venueBody('a')) });
    expect(r.status).toBe(403);
  });
});

describe('게시 흐름과 공개 데이터', () => {
  it('동의·승인 없이 게시 불가', async () => {
    expect((await admin('/venues/a', { method: 'PUT', body: JSON.stringify(venueBody('a', { isPublished: true })) })).status).toBe(409);
    expect((await admin('/venues/a', { method: 'PUT', body: JSON.stringify(venueBody('a')) })).status).toBe(200);
    expect((await admin('/venues/a/publish', { method: 'POST', body: JSON.stringify({ published: true }) })).status).toBe(409);
  });

  it('비공개 업소는 공개 API에 없음', async () => {
    const r = await (await fetch(`${base}/api/public/venues`)).json();
    expect(r.venues).toEqual([]);
    expect((await fetch(`${base}/api/public/venues/a`)).status).toBe(404);
  });

  it('동의+승인+게시 후 공개, 내부 메모는 공개 응답에 없음', async () => {
    const body = venueBody('a', { isPublished: true });
    body.ops = { ...body.ops, consentStatus: 'agreed', reviewStatus: 'approved' };
    expect((await admin('/venues/a', { method: 'PUT', body: JSON.stringify(body) })).status).toBe(200);
    const text = await (await fetch(`${base}/api/public/venues`)).text();
    expect(JSON.parse(text).venues.map((v: { id: string }) => v.id)).toEqual(['a']);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('isPublished');
    expect(text).not.toContain('consentStatus');
  });

  it('관리자 변경이 실제 저장 파일에 반영', async () => {
    const saved = JSON.parse(readFileSync(path.join(dir, 'venues.json'), 'utf8'));
    expect(saved[0].name).toBe('업소 a');
    const ops = JSON.parse(readFileSync(path.join(dir, 'ops.json'), 'utf8'));
    expect(ops[0].staffNote).toBe('내부 메모 SECRET'); // 비공개 저장소에만
  });

  it('게시 중단 즉시 비공개', async () => {
    await admin('/venues/a/publish', { method: 'POST', body: JSON.stringify({ published: false }) });
    expect((await (await fetch(`${base}/api/public/venues`)).json()).venues).toEqual([]);
  });
});

describe('기간 한정 안내 문구', () => {
  it('승인 + 기간 내만 공개', async () => {
    const now = Date.now();
    const iso = (d: number) => new Date(now + d * 86400e3).toISOString();
    await admin('/settings', { method: 'PUT', body: JSON.stringify({
      showBeverageInfo: true, contactEmail: null, mapCenter: { latitude: 37.66, longitude: 126.77, level: 5 },
      notices: [
        { id: 'on', text: '진행 중', startAt: iso(-1), endAt: iso(1), approved: true },
        { id: 'ended', text: '종료됨', startAt: iso(-5), endAt: iso(-1), approved: true },
        { id: 'unapproved', text: '미승인', startAt: iso(-1), endAt: iso(1), approved: false },
      ],
    }) });
    const c = await (await fetch(`${base}/api/public/config`)).json();
    expect(c.notices.map((n: { id: string }) => n.id)).toEqual(['on']);
  });
});

describe('이벤트 집계', () => {
  it('등록되지 않은 source는 묶어서 기록, 개인 식별 정보 없음', async () => {
    await admin('/campaigns/lake-banner-01', { method: 'PUT', body: JSON.stringify({ id: 'lake-banner-01', label: '배너', targetPath: '/explore', placement: null, active: true }) });
    const send = (body: object) => fetch(`${base}/api/events`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
    expect((await send({ name: 'landing_view', source: 'lake-banner-01', timestamp: new Date().toISOString() })).status).toBe(204);
    await send({ name: 'directions_click', venueId: 'a', source: 'random-thing' });
    expect((await send({ name: 'purchase', source: 'x' })).status).toBe(400);
    const m = await (await admin('/metrics')).json();
    const keys = Object.keys(Object.values(m.days)[0] as object);
    expect(keys).toContain('landing_view|-|lake-banner-01|');
    expect(keys).toContain('directions_click|a|unregistered|');
    expect(readFileSync(path.join(dir, 'metrics.json'), 'utf8')).not.toMatch(/127\.0\.0\.1|::1/);
  });
});

describe('오류 제보', () => {
  it('접수 및 입력 검증', async () => {
    expect((await fetch(`${base}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueId: 'a', kind: 'hours', message: '<b>시간 다름</b>' }) })).status).toBe(201);
    expect((await fetch(`${base}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueId: '../x', kind: 'hours' }) })).status).toBe(400);
    const reports = await (await admin('/reports')).json();
    expect(reports[0].message).toBe('<b>시간 다름</b>'); // 저장은 원문, 화면에는 텍스트로만 렌더링
  });
});
