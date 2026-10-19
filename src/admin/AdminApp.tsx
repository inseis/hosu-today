import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import type { Campaign, ErrorReport, SiteSettings, Venue, VenueOps } from '../../shared/types';
import { site } from '../config/site';
import { api, ApiError } from './api';
import { ImportTab } from './ImportTab';
import { QrTab } from './QrTab';
import { VenueEditor } from './VenueEditor';
import '../styles/admin.css';

export interface AdminVenueRow {
  venue: Venue;
  ops: VenueOps;
  eligible: boolean;
  blockers: string[];
}

type Me = { authenticated: boolean; configured: boolean; username: string | null; analyticsEnabled: boolean };

export default function AdminApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const refresh = useCallback(() => {
    fetch('/api/admin/me', { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error();
        return r.json();
      })
      .then(setMe)
      .catch(() => setUnreachable(true));
  }, []);
  useEffect(refresh, [refresh]);

  if (unreachable) {
    return (
      <main className="admin page-pad">
        <h1 className="page-title">관리자</h1>
        <div className="notice notice-warn">
          <div>
            관리자 API 서버에 연결할 수 없습니다. 이 배포는 정적(JSON) 공개 화면만 제공하는 구성일 수 있습니다.
            업소 정보 수정은 README의 <strong>“서버 없이 운영하기”</strong> 절차(로컬에서 서버 실행 → 수정 → <code>npm run export:public</code> → 재배포)를 따르세요.
          </div>
        </div>
      </main>
    );
  }
  if (!me) return <div className="page-loading">확인 중…</div>;
  if (!me.configured) {
    return (
      <main className="admin page-pad">
        <h1 className="page-title">관리자 계정 미설정</h1>
        <p>서버 환경변수 <code>ADMIN_PASSWORD_HASH</code>, <code>SESSION_SECRET</code>이 필요합니다. README의 “관리자 계정 설정”을 참고하세요.</p>
      </main>
    );
  }
  if (!me.authenticated) return <Login onDone={refresh} />;
  return <AdminShell me={me} onLogout={refresh} />;
}

function Login({ onDone }: { onDone(): void }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="admin admin-login">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          const r = await fetch('/api/admin/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
          if (r.ok) onDone();
          else setErr((await r.json().catch(() => null))?.error ?? '로그인 실패');
        }}
      >
        <h1>관리자 로그인</h1>
        <p className="muted small">{site.name}</p>
        <label>아이디<input autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} required /></label>
        <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} required /></label>
        {err && <p className="error-text" role="alert">{err}</p>}
        <button className="btn btn-primary btn-block" type="submit">로그인</button>
      </form>
    </main>
  );
}

function AdminShell({ me, onLogout }: { me: Me; onLogout(): void }) {
  return (
    <div className="admin">
      <header className="admin-header">
        <strong>{site.name} · 운영 관리</strong>
        <nav className="admin-nav">
          <NavLink to="/admin" end>업소</NavLink>
          <NavLink to="/admin/import">CSV 가져오기</NavLink>
          <NavLink to="/admin/qr">캠페인·QR</NavLink>
          <NavLink to="/admin/reports">오류 제보</NavLink>
          <NavLink to="/admin/metrics">이용 지표</NavLink>
          <NavLink to="/admin/settings">설정</NavLink>
        </nav>
        <div className="admin-user">
          {me.username}
          <button type="button" className="btn btn-small btn-ghost" onClick={async () => { await api('/logout', { method: 'POST' }).catch(() => undefined); onLogout(); }}>로그아웃</button>
        </div>
      </header>
      <main className="admin-main">
        <Routes>
          <Route index element={<VenuesTab />} />
          <Route path="venues/:id" element={<VenueEditor />} />
          <Route path="import" element={<ImportTab />} />
          <Route path="qr" element={<QrTab />} />
          <Route path="reports" element={<ReportsTab />} />
          <Route path="metrics" element={<MetricsTab analyticsEnabled={me.analyticsEnabled} />} />
          <Route path="settings" element={<SettingsTab />} />
        </Routes>
      </main>
    </div>
  );
}

export function useAdminVenues() {
  const [rows, setRows] = useState<AdminVenueRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api<AdminVenueRow[]>('/venues').then(setRows).catch((e: ApiError) => setErr(e.message));
  }, []);
  useEffect(load, [load]);
  return { rows, err, reload: load };
}

const CONSENT_LABEL = { pending: '동의 대기', agreed: '게시 동의', withdrawn: '동의 철회' } as const;
const REVIEW_LABEL = { draft: '작성 중', in_review: '검토 중', approved: '승인', rejected: '반려' } as const;

function VenuesTab() {
  const { rows, err, reload } = useAdminVenues();
  const [msg, setMsg] = useState<string | null>(null);
  const setPublished = async (id: string, published: boolean) => {
    setMsg(null);
    try {
      await api(`/venues/${id}/publish`, { method: 'POST', body: { published } });
      reload();
    } catch (e) {
      setMsg((e as ApiError).message);
    }
  };
  if (err) return <p className="error-text">{err}</p>;
  if (!rows) return <p>불러오는 중…</p>;
  return (
    <section>
      <div className="admin-title-row">
        <h1>업소 ({rows.length})</h1>
        <Link className="btn btn-primary" to="/admin/venues/new">새 업소 등록</Link>
      </div>
      <p className="muted small">고객 화면에는 <strong>게시 ON + 게시 동의 + 검토 승인</strong>이 모두 충족된 업소만 나타납니다. 후보 업소를 자동 공개하지 않습니다.</p>
      {msg && <p className="error-text" role="alert">{msg}</p>}
      {rows.length === 0 ? <p>등록된 업소가 없습니다. 직접 등록하거나 CSV로 가져오세요.</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>순서</th><th>업소</th><th>동의</th><th>검토</th><th>좌표</th><th>확인일</th><th>고객 노출</th><th /></tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => a.venue.displayOrder - b.venue.displayOrder).map(({ venue: v, ops, eligible, blockers }) => (
                <tr key={v.id}>
                  <td>{v.displayOrder}</td>
                  <td><strong>{v.name}</strong><br /><span className="muted small">{v.id}</span></td>
                  <td>{CONSENT_LABEL[ops.consentStatus]}</td>
                  <td>{REVIEW_LABEL[ops.reviewStatus]}</td>
                  <td>{v.latitude !== null ? '확인' : <span className="warn-text">미확인</span>}</td>
                  <td>{v.informationVerifiedAt ?? '-'}</td>
                  <td>
                    {eligible ? <span className="pill pill-on">● 노출 중</span> : <span className="pill">○ 비공개</span>}
                    {!eligible && v.isPublished && <div className="muted small">{blockers.join(', ')}</div>}
                  </td>
                  <td className="row-actions">
                    <Link className="btn btn-small btn-secondary" to={`/admin/venues/${v.id}`}>편집</Link>
                    {v.isPublished
                      ? <button type="button" className="btn btn-small btn-ghost" onClick={() => setPublished(v.id, false)}>게시 중단</button>
                      : <button type="button" className="btn btn-small btn-ghost" onClick={() => setPublished(v.id, true)} title={blockers.join(', ')}>게시</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReportsTab() {
  const [rows, setRows] = useState<ErrorReport[] | null>(null);
  const load = useCallback(() => { api<ErrorReport[]>('/reports').then(setRows); }, []);
  useEffect(load, [load]);
  if (!rows) return <p>불러오는 중…</p>;
  return (
    <section>
      <h1>정보 오류 제보 ({rows.filter((r) => !r.resolved).length}건 미처리)</h1>
      {rows.length === 0 ? <p>접수된 제보가 없습니다.</p> : (
        <ul className="report-list">
          {[...rows].reverse().map((r) => (
            <li key={r.id} className={r.resolved ? 'is-resolved' : ''}>
              <div><strong>{r.venueId}</strong> · {r.kind} · <span className="muted small">{new Date(r.createdAt).toLocaleString('ko-KR')}</span></div>
              {/* 사용자 입력은 텍스트로만 표시 */}
              <p>{r.message || <span className="muted">(내용 없음)</span>}</p>
              <div className="row-actions">
                <Link className="btn btn-small btn-secondary" to={`/admin/venues/${r.venueId}`}>업소 편집</Link>
                <button type="button" className="btn btn-small btn-ghost" onClick={async () => { await api(`/reports/${r.id}`, { method: 'PATCH', body: { resolved: !r.resolved } }); load(); }}>
                  {r.resolved ? '미처리로 되돌리기' : '처리 완료'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const EVENT_LABEL: Record<string, string> = {
  landing_view: 'QR·링크 경로 접속 수',
  venue_open: '업소 상세 열람',
  directions_click: '길찾기 버튼 클릭 (카카오맵 이동)',
  menu_open: '메뉴 펼침',
  share_click: '공유 버튼 클릭',
  filter_apply: '필터 적용',
};

function MetricsTab({ analyticsEnabled }: { analyticsEnabled: boolean }) {
  const [data, setData] = useState<{ enabled: boolean; days: Record<string, Record<string, number>> } | null>(null);
  useEffect(() => { api<typeof data>('/metrics').then(setData); }, []);
  if (!data) return <p>불러오는 중…</p>;
  const totals = new Map<string, number>();
  const bySource = new Map<string, Map<string, number>>();
  for (const day of Object.values(data.days)) {
    for (const [key, n] of Object.entries(day)) {
      const [name, , source] = key.split('|');
      totals.set(name, (totals.get(name) ?? 0) + n);
      const m = bySource.get(source) ?? new Map<string, number>();
      m.set(name, (m.get(name) ?? 0) + n);
      bySource.set(source, m);
    }
  }
  const cols = ['landing_view', 'venue_open', 'directions_click'];
  return (
    <section>
      <h1>이용 지표</h1>
      {!analyticsEnabled && (
        <div className="notice notice-warn"><div>이벤트 집계가 꺼져 있습니다(ANALYTICS_ENABLED=false). 아래 수치는 비어 있으며 실제 수집 중이 아닙니다.</div></div>
      )}
      <p className="muted small">
        ‘QR·링크 경로 접속 수’는 QR 스캔 수가 아닙니다(링크 공유로도 접속 가능). ‘길찾기 클릭’은 카카오맵으로 이동한 횟수이며 실제 방문·구매가 아닙니다.
      </p>
      {totals.size === 0 ? <p>집계된 이벤트가 없습니다.</p> : (
        <>
          <ul className="metric-grid">
            {Object.keys(EVENT_LABEL).map((k) => (
              <li key={k}><span>{EVENT_LABEL[k]}</span><strong>{(totals.get(k) ?? 0).toLocaleString('ko-KR')}</strong></li>
            ))}
          </ul>
          <h2>유입 경로(source)별</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>source</th>{cols.map((c) => <th key={c}>{EVENT_LABEL[c]}</th>)}</tr></thead>
              <tbody>
                {[...bySource.entries()].map(([s, m]) => (
                  <tr key={s}><td>{s}</td>{cols.map((c) => <td key={c}>{m.get(c) ?? 0}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SettingsTab() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<SiteSettings>('/settings').then(setS); }, []);
  if (!s) return <p>불러오는 중…</p>;
  const save = async () => {
    try {
      await api('/settings', { method: 'PUT', body: s });
      setMsg('저장했습니다.');
    } catch (e) {
      setMsg((e as ApiError).message);
    }
  };
  const now = new Date();
  return (
    <section className="admin-form">
      <h1>설정</h1>
      <fieldset>
        <legend>음료 브랜드 정보 노출</legend>
        <label className="check"><input type="checkbox" checked={s.showBeverageInfo} onChange={(e) => setS({ ...s, showBeverageInfo: e.target.checked })} /> 고객 화면에 음료 취급 배지·음료 선택 필터 표시</label>
        <p className="muted small">주류 브랜드 노출 방식과 문구는 운영 담당자가 광고 관련 기준을 확인한 뒤 켜세요. QR에 들어갔다는 이유로 검토가 끝난 것은 아닙니다.</p>
      </fieldset>
      <fieldset>
        <legend>지역 중심점 (공개 업소가 없을 때 사용)</legend>
        <div className="grid-3">
          <label>위도<input type="number" step="0.0001" value={s.mapCenter.latitude} onChange={(e) => setS({ ...s, mapCenter: { ...s.mapCenter, latitude: Number(e.target.value) } })} /></label>
          <label>경도<input type="number" step="0.0001" value={s.mapCenter.longitude} onChange={(e) => setS({ ...s, mapCenter: { ...s.mapCenter, longitude: Number(e.target.value) } })} /></label>
          <label>확대 수준(1~14)<input type="number" min={1} max={14} value={s.mapCenter.level} onChange={(e) => setS({ ...s, mapCenter: { ...s.mapCenter, level: Number(e.target.value) } })} /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>오류 제보 대체 연락처 (공개 이메일)</legend>
        <input type="email" value={s.contactEmail ?? ''} onChange={(e) => setS({ ...s, contactEmail: e.target.value || null })} />
      </fieldset>
      <fieldset>
        <legend>기간 한정 안내 문구</legend>
        <p className="muted small">시작~종료 기간에만, ‘문구 검토 완료’ 체크된 항목만 고객 화면에 표시됩니다. 확인되지 않은 이벤트·무료 제공·지원 확약 문구는 쓰지 마세요.</p>
        {s.notices.map((n, i) => {
          const live = n.approved && new Date(n.startAt) <= now && now <= new Date(n.endAt);
          const upd = (p: Partial<typeof n>) => setS({ ...s, notices: s.notices.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={n.id || i} className="notice-edit">
              <label>문구<input maxLength={120} value={n.text} onChange={(e) => upd({ text: e.target.value })} /></label>
              <div className="grid-3">
                <label>시작<input type="datetime-local" value={toLocalInput(n.startAt)} onChange={(e) => upd({ startAt: fromLocalInput(e.target.value) })} /></label>
                <label>종료<input type="datetime-local" value={toLocalInput(n.endAt)} onChange={(e) => upd({ endAt: fromLocalInput(e.target.value) })} /></label>
                <label className="check"><input type="checkbox" checked={n.approved} onChange={(e) => upd({ approved: e.target.checked })} /> 문구 검토 완료</label>
              </div>
              <p className="small">{live ? '● 현재 노출 중' : '○ 현재 미노출'} <button type="button" className="btn btn-small btn-ghost" onClick={() => setS({ ...s, notices: s.notices.filter((_, j) => j !== i) })}>삭제</button></p>
            </div>
          );
        })}
        <button type="button" className="btn btn-small btn-secondary" onClick={() => setS({ ...s, notices: [...s.notices, { id: '', text: '', startAt: new Date().toISOString(), endAt: new Date(Date.now() + 7 * 86400e3).toISOString(), approved: false }] })}>안내 문구 추가</button>
      </fieldset>
      <button type="button" className="btn btn-primary" onClick={save}>설정 저장</button>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toISOString();
}

export type { Campaign };
