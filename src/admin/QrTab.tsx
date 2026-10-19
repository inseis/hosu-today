import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { buildCampaignUrl, isAllowedTargetPath, SOURCE_RE } from '../../shared/links';
import type { Campaign } from '../../shared/types';
import { env, withBase } from '../config/site';
import { api, ApiError } from './api';
import { useAdminVenues } from './AdminApp';

const QR_OPTS = { errorCorrectionLevel: 'M' as const, margin: 4, color: { dark: '#000000', light: '#ffffff' } };

function baseUrl(): { url: string; isPreview: boolean } {
  const configured = env.publicBaseUrl;
  const url = configured || `${location.origin}${withBase('')}`;
  const isPreview = !configured || /localhost|127\.0\.0\.1|\.local\b/.test(url);
  return { url, isPreview };
}

export function QrTab() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ id: '', label: '', targetPath: '/explore', placement: '' });
  const [err, setErr] = useState<string | null>(null);
  const { rows } = useAdminVenues();

  const load = useCallback(() => { api<Campaign[]>('/campaigns').then(setCampaigns); }, []);
  useEffect(load, [load]);

  const save = async () => {
    setErr(null);
    if (!SOURCE_RE.test(form.id)) return setErr('source 값은 영문 소문자·숫자·하이픈으로 (예: lake-banner-01)');
    if (!isAllowedTargetPath(form.targetPath)) return setErr('대상 경로는 /explore 또는 /venues/{slug}');
    try {
      await api(`/campaigns/${form.id}`, { method: 'PUT', body: { ...form, placement: form.placement || null, active: true } });
      setSelected(form.id);
      setForm({ id: '', label: '', targetPath: '/explore', placement: '' });
      load();
    } catch (e) {
      setErr((e as ApiError).message);
    }
  };

  const camp = campaigns?.find((c) => c.id === selected) ?? null;
  const { isPreview } = baseUrl();

  return (
    <section>
      <h1>캠페인·QR</h1>
      <p className="muted small">
        QR에는 고정 주소(<code>/explore?source=…</code> 또는 <code>/venues/{'{slug}'}?source=…</code>)만 담기므로, 배너를 다시 인쇄하지 않아도 업소 정보는 관리자 화면에서 수정할 수 있습니다.
        QR은 외부 QR 서비스 없이 표준 라이브러리(qrcode)로 이 브라우저에서 생성합니다.
      </p>
      {isPreview && (
        <div className="notice notice-warn"><div><strong>미리보기용 QR</strong> — <code>VITE_PUBLIC_BASE_URL</code>(실제 배포 도메인)이 설정되지 않았거나 로컬 주소입니다. 인쇄용 QR은 실제 도메인을 설정해 다시 빌드한 뒤 생성하세요.</div></div>
      )}

      <div className="qr-layout">
        <div>
          <h2>캠페인 목록</h2>
          {!campaigns ? <p>불러오는 중…</p> : campaigns.length === 0 ? <p>등록된 캠페인이 없습니다.</p> : (
            <ul className="campaign-list">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button type="button" className={`campaign-item${c.id === selected ? ' is-on' : ''}`} onClick={() => setSelected(c.id)}>
                    <strong>{c.label || c.id}</strong>
                    <span className="small muted">{c.targetPath}?source={c.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="admin-form card">
            <h3>캠페인 추가·수정</h3>
            <label>source 값<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.trim() })} placeholder="lake-banner-01" /></label>
            <label>이름<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="호수공원 산책로 배너 1" /></label>
            <label>대상
              <select value={form.targetPath} onChange={(e) => setForm({ ...form, targetPath: e.target.value })}>
                <option value="/explore">탐색 화면 (/explore)</option>
                {(rows ?? []).map((r) => <option key={r.venue.id} value={`/venues/${r.venue.slug}`}>업소 상세: {r.venue.name}{r.eligible ? '' : ' (현재 비공개)'}</option>)}
              </select>
            </label>
            <label>설치 위치 메모<input value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} /></label>
            {err && <p className="error-text">{err}</p>}
            <button type="button" className="btn btn-primary" onClick={save}>저장</button>
          </div>
        </div>
        <div>{camp ? <QrPreview campaign={camp} isPreview={isPreview} /> : <p className="muted">왼쪽에서 캠페인을 선택하세요.</p>}</div>
      </div>
    </section>
  );
}

function QrPreview({ campaign, isPreview }: { campaign: Campaign; isPreview: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = buildCampaignUrl(baseUrl().url, campaign.targetPath, campaign.id);
  const [check, setCheck] = useState<{ ok: boolean; decoded: string | null } | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setCheck(null);
    (async () => {
      if (!canvas.current) return;
      await QRCode.toCanvas(canvas.current, target, { ...QR_OPTS, scale: 10 });
      const ctx = canvas.current.getContext('2d')!;
      const img = ctx.getImageData(0, 0, canvas.current.width, canvas.current.height);
      // 생성한 QR을 다시 해독해 목적 URL과 비교
      const decoded = jsQR(img.data, img.width, img.height)?.data ?? null;
      const s = await QRCode.toString(target, { ...QR_OPTS, type: 'svg' });
      if (!alive) return;
      setCheck({ ok: decoded === target, decoded });
      setSvg(s);
    })();
    return () => { alive = false; };
  }, [target]);

  const download = (href: string, ext: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = `qr-${campaign.id}${isPreview ? '-preview' : ''}.${ext}`;
    a.click();
  };

  return (
    <div className="qr-preview">
      <h2>{campaign.label || campaign.id}</h2>
      <p className="small"><code>{target}</code></p>
      <div className="qr-and-page">
        <figure className="qr-figure">
          {/* QR 위에 장식·로고를 덮지 않음. 여백(quiet zone) 4모듈 포함, 정사각형 */}
          <canvas ref={canvas} className="qr-canvas" aria-label="QR 코드" />
          {isPreview && <figcaption className="warn-text">미리보기 — 인쇄용 아님</figcaption>}
        </figure>
        <div className="phone phone-sm" aria-label="연결 페이지 미리보기">
          <iframe title="연결 페이지 미리보기" src={`${withBase(campaign.targetPath)}?source=admin-preview`} />
        </div>
      </div>
      {check && (
        <p className={check.ok ? 'ok-text' : 'error-text'} role="status">
          {check.ok ? '✓ 해독 결과가 목적 URL과 일치합니다.' : `✗ 해독 결과 불일치: ${check.decoded ?? '해독 실패'}`}
        </p>
      )}
      <div className="row-actions">
        <button type="button" className="btn btn-secondary" disabled={!check?.ok} onClick={() => canvas.current && download(canvas.current.toDataURL('image/png'), 'png')}>PNG 다운로드</button>
        <button type="button" className="btn btn-secondary" disabled={!check?.ok || !svg} onClick={() => svg && download(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), 'svg')}>SVG 다운로드</button>
      </div>
      <p className="muted small">인쇄 전 실제 휴대폰 카메라로도 스캔해 확인하세요. 연결 페이지 미리보기의 접속은 source=admin-preview로 구분됩니다.</p>
    </div>
  );
}
