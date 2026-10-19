import path from 'node:path';
import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { buildImportPreview } from '../shared/csv';
import { isAllowedTargetPath, SOURCE_RE } from '../shared/links';
import { emptyOps, isPublicEligible, publishBlockers } from '../shared/ops';
import { toPublicVenue, validateVenue } from '../shared/venue';
import type { AnalyticsEventName, Campaign, ErrorReport, Notice, SiteSettings, Venue, VenueOps } from '../shared/types';
import { authConfigured, clearSession, issueSession, loginRateLimited, readSession, requireAdmin, verifyPassword } from './auth';
import { DEFAULT_SETTINGS, read, update } from './store';

const EVENT_NAMES: AnalyticsEventName[] = ['landing_view', 'filter_apply', 'venue_open', 'directions_click', 'menu_open', 'share_click'];

export async function publicVenues() {
  const [venues, ops] = await Promise.all([read('venues'), read('ops')]);
  const opsById = new Map(ops.map((o) => [o.venueId, o]));
  return venues.filter((v) => isPublicEligible(v, opsById.get(v.id))).map(toPublicVenue);
}

export function activeNotices(notices: Notice[], now = new Date()): Notice[] {
  return notices.filter((n) => n.approved && new Date(n.startAt) <= now && now <= new Date(n.endAt));
}

export function publicSettings(s: SiteSettings, now = new Date()) {
  return {
    notices: activeNotices(s.notices, now).map((n) => ({ id: n.id, text: n.text })),
    showBeverageInfo: s.showBeverageInfo,
    mapCenter: s.mapCenter,
    contactEmail: s.contactEmail,
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    });
    next();
  });

  // ───────── 공개 API ─────────
  app.get('/api/public/venues', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ venues: await publicVenues(), generatedAt: new Date().toISOString() });
  });

  app.get('/api/public/parking', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ parking: await read('parking') });
  });

  app.get('/api/public/venues/:slug', async (req, res) => {
    const v = (await publicVenues()).find((x) => x.slug === req.params.slug);
    if (!v) return res.status(404).json({ error: 'not_found' });
    res.json({ venue: v });
  });

  app.get('/api/public/config', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(publicSettings({ ...DEFAULT_SETTINGS, ...(await read('settings')) }));
  });

  app.post('/api/reports', async (req, res) => {
    const { venueId, kind, message } = req.body ?? {};
    const kinds: ErrorReport['kind'][] = ['hours', 'menu', 'location', 'parking', 'beverage', 'closed', 'other'];
    if (typeof venueId !== 'string' || !/^[a-z0-9-]{1,60}$/.test(venueId) || !kinds.includes(kind)) {
      return res.status(400).json({ error: '잘못된 요청입니다.' });
    }
    const text = typeof message === 'string' ? message.trim().slice(0, 500) : '';
    // 제보자 식별 정보(IP 등)는 저장하지 않는다
    await update('reports', (cur) => ({
      next: [...cur.slice(-999), { id: crypto.randomUUID(), venueId, kind, message: text, createdAt: new Date().toISOString(), resolved: false }],
    }));
    res.status(201).json({ ok: true });
  });

  app.post('/api/events', express.text({ type: '*/*', limit: '4kb' }), async (req, res) => {
    if (process.env.ANALYTICS_ENABLED !== 'true') return res.status(202).json({ stored: false });
    let body: Record<string, unknown>;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).end();
    }
    const name = body?.name as AnalyticsEventName;
    if (!EVENT_NAMES.includes(name)) return res.status(400).end();
    const venueId = typeof body.venueId === 'string' && /^[a-z0-9-]{1,60}$/.test(body.venueId) ? body.venueId : '-';
    const rawSource = typeof body.source === 'string' ? body.source : '';
    const campaigns = await read('campaigns');
    // 등록된 캠페인만 그대로 기록, 그 외는 구분값으로 묶음
    const source = !rawSource ? 'direct' : campaigns.some((c) => c.id === rawSource) ? rawSource : 'unregistered';
    const filter = name === 'filter_apply' && typeof body.filterSummary === 'string' ? body.filterSummary.slice(0, 120).replace(/[^a-z0-9:+|-]/gi, '') : '';
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const key = [name, venueId, source, filter].join('|');
    await update('metrics', (m) => {
      const d = (m[day] ??= {});
      d[key] = (d[key] ?? 0) + 1;
      return { next: m };
    });
    res.status(204).end();
  });

  // ───────── 관리자 API ─────────
  app.post('/api/admin/login', (req, res) => {
    if (!authConfigured()) return res.status(503).json({ error: '서버에 관리자 계정(ADMIN_PASSWORD_HASH, SESSION_SECRET)이 설정되지 않았습니다.' });
    if (loginRateLimited(req.ip ?? 'unknown')) return res.status(429).json({ error: '잠시 후 다시 시도하세요.' });
    const { username, password } = req.body ?? {};
    const ok = typeof username === 'string' && typeof password === 'string'
      && username === (process.env.ADMIN_USERNAME || 'admin')
      && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);
    if (!ok) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    issueSession(res, username);
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    const s = readSession(req);
    res.json({ authenticated: !!s, configured: authConfigured(), username: s?.u ?? null, analyticsEnabled: process.env.ANALYTICS_ENABLED === 'true' });
  });

  app.post('/api/admin/logout', (_req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get('/venues', async (_req, res) => {
    const [venues, ops] = await Promise.all([read('venues'), read('ops')]);
    const byId = new Map(ops.map((o) => [o.venueId, o]));
    res.json(venues.map((v) => {
      const o = byId.get(v.id) ?? emptyOps(v.id);
      return { venue: v, ops: o, eligible: isPublicEligible(v, o), blockers: publishBlockers(v, o) };
    }));
  });

  admin.put('/venues/:id', async (req: Request, res: Response) => {
    const venue = req.body?.venue as Venue;
    const ops = req.body?.ops as Partial<VenueOps> | undefined;
    const errors = validateVenue(venue ?? {});
    if (errors.length) return res.status(400).json({ errors });
    if (req.params.id !== venue.id) return res.status(400).json({ errors: ['id 불일치'] });
    const venues = await read('venues');
    if (venues.some((v) => v.slug === venue.slug && v.id !== venue.id)) return res.status(409).json({ errors: ['slug 중복'] });
    const opsList = await read('ops');
    const prevOps = opsList.find((o) => o.venueId === venue.id) ?? emptyOps(venue.id);
    const nextOps = { ...prevOps, ...pickOps(ops), venueId: venue.id, updatedAt: new Date().toISOString() };
    // 동의·승인이 없는 상태로는 게시 상태 저장 불가
    if (venue.isPublished && !(nextOps.consentStatus === 'agreed' && nextOps.reviewStatus === 'approved')) {
      return res.status(409).json({ errors: ['게시하려면 게시 동의(agreed)와 검토 승인(approved)이 필요합니다.'] });
    }
    await update('venues', (cur) => {
      const i = cur.findIndex((v) => v.id === venue.id);
      const next = [...cur];
      if (i >= 0) next[i] = venue; else next.push(venue);
      return { next };
    });
    await update('ops', (cur) => ({ next: [...cur.filter((o) => o.venueId !== venue.id), nextOps] }));
    res.json({ ok: true });
  });

  admin.post('/venues/:id/publish', async (req, res) => {
    const publish = req.body?.published === true;
    const ops = (await read('ops')).find((o) => o.venueId === req.params.id);
    if (publish && !(ops?.consentStatus === 'agreed' && ops?.reviewStatus === 'approved')) {
      return res.status(409).json({ errors: ['게시 동의와 검토 승인이 확인되지 않았습니다.'] });
    }
    const found = await update('venues', (cur) => {
      const v = cur.find((x) => x.id === req.params.id);
      if (v) v.isPublished = publish;
      return { next: cur, result: !!v };
    });
    if (!found) return res.status(404).json({ errors: ['업소 없음'] });
    res.json({ ok: true });
  });

  admin.delete('/venues/:id', async (req, res) => {
    await update('venues', (cur) => ({ next: cur.filter((v) => v.id !== req.params.id) }));
    await update('ops', (cur) => ({ next: cur.filter((o) => o.venueId !== req.params.id) }));
    res.json({ ok: true });
  });

  admin.post('/import/apply', async (req, res) => {
    const { headers, rows } = req.body ?? {};
    if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length > 2000) return res.status(400).json({ errors: ['잘못된 CSV 데이터'] });
    // 서버에서 다시 검증한 결과만 반영 (클라이언트 미리보기를 신뢰하지 않음)
    const preview = buildImportPreview(headers, rows, await read('venues'));
    const apply = preview.rows.filter((r) => r.status === 'new' || r.status === 'update');
    await update('venues', (cur) => {
      const next = [...cur];
      for (const r of apply) {
        const i = next.findIndex((v) => v.id === r.venue.id);
        if (i >= 0) next[i] = r.venue; else next.push(r.venue);
      }
      return { next };
    });
    await update('ops', (cur) => {
      const next = [...cur];
      for (const r of apply) {
        const i = next.findIndex((o) => o.venueId === r.venue.id);
        const base = i >= 0 ? next[i] : emptyOps(r.venue.id);
        const merged = { ...base, ...pickOps(r.ops), updatedAt: new Date().toISOString() };
        if (i >= 0) next[i] = merged; else next.push(merged);
      }
      return { next };
    });
    res.json({ applied: apply.length, skipped: preview.rows.length - apply.length });
  });

  admin.get('/campaigns', async (_req, res) => res.json(await read('campaigns')));
  admin.put('/campaigns/:id', async (req, res) => {
    const c = req.body as Campaign;
    if (!SOURCE_RE.test(req.params.id) || c?.id !== req.params.id) return res.status(400).json({ errors: ['source 값: 영문 소문자·숫자·하이픈'] });
    if (!isAllowedTargetPath(c.targetPath)) return res.status(400).json({ errors: ['대상 경로: /explore 또는 /venues/{slug}'] });
    const clean: Campaign = {
      id: c.id, label: String(c.label ?? '').slice(0, 80), targetPath: c.targetPath,
      placement: c.placement ? String(c.placement).slice(0, 200) : null, active: c.active !== false,
      createdAt: c.createdAt || new Date().toISOString(),
    };
    await update('campaigns', (cur) => ({ next: [...cur.filter((x) => x.id !== clean.id), clean] }));
    res.json({ ok: true });
  });

  admin.get('/settings', async (_req, res) => res.json({ ...DEFAULT_SETTINGS, ...(await read('settings')) }));
  admin.put('/settings', async (req, res) => {
    const s = req.body as SiteSettings;
    const c = s?.mapCenter;
    if (!c || !(c.latitude > 33 && c.latitude < 39 && c.longitude > 124 && c.longitude < 132 && c.level >= 1 && c.level <= 14)) {
      return res.status(400).json({ errors: ['지도 중심점 값 오류'] });
    }
    const clean: SiteSettings = {
      showBeverageInfo: !!s.showBeverageInfo,
      mapCenter: { latitude: c.latitude, longitude: c.longitude, level: Math.round(c.level) },
      contactEmail: typeof s.contactEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contactEmail) ? s.contactEmail : null,
      notices: (s.notices ?? []).filter((n) => n.text && !isNaN(Date.parse(n.startAt)) && !isNaN(Date.parse(n.endAt))).map((n) => ({
        id: n.id || crypto.randomUUID(), text: String(n.text).slice(0, 120), startAt: n.startAt, endAt: n.endAt, approved: !!n.approved,
      })),
    };
    await update('settings', () => ({ next: clean }));
    res.json({ ok: true });
  });

  admin.get('/reports', async (_req, res) => res.json(await read('reports')));
  admin.patch('/reports/:id', async (req, res) => {
    await update('reports', (cur) => ({ next: cur.map((r) => (r.id === req.params.id ? { ...r, resolved: !!req.body?.resolved } : r)) }));
    res.json({ ok: true });
  });

  admin.get('/metrics', async (_req, res) => {
    res.json({ enabled: process.env.ANALYTICS_ENABLED === 'true', days: await read('metrics') });
  });

  app.use('/api/admin', admin);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // ───────── 배포: 빌드된 프런트엔드 제공 ─────────
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve('dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}

function pickOps(o: Partial<VenueOps> | undefined): Partial<VenueOps> {
  if (!o) return {};
  const out: Partial<VenueOps> = {};
  if (o.consentStatus && ['pending', 'agreed', 'withdrawn'].includes(o.consentStatus)) {
    out.consentStatus = o.consentStatus;
    if (o.consentStatus === 'agreed') out.consentRecordedAt = o.consentRecordedAt ?? new Date().toISOString().slice(0, 10);
  }
  if (o.reviewStatus && ['draft', 'in_review', 'approved', 'rejected'].includes(o.reviewStatus)) out.reviewStatus = o.reviewStatus;
  if (o.verificationEvidence !== undefined) out.verificationEvidence = o.verificationEvidence ? String(o.verificationEvidence).slice(0, 1000) : null;
  if (o.staffNote !== undefined) out.staffNote = o.staffNote ? String(o.staffNote).slice(0, 1000) : null;
  return out;
}
