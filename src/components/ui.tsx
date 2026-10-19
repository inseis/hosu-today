import { useState, type ReactNode } from 'react';
import { getOpenStatus, statusLabel } from '../../shared/hours';
import type { Beverage, PublicVenue } from '../../shared/types';
import { SERVING_LABEL } from '../lib/format';

type IconName = 'pin' | 'search' | 'car' | 'clock' | 'map' | 'list' | 'locate' | 'route' | 'share' | 'back' | 'close' | 'glass' | 'door' | 'info' | 'check' | 'filter';

const PATHS: Record<IconName, string> = {
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  search: 'M11 4a7 7 0 1 0 4.4 12.4L20 21l1-1-4.6-4.6A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  car: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v2h-2v-2H9v2H7v-2H5v-6Zm2.2 0h9.6l-1.1-3.4a.6.6 0 0 0-.6-.4H8.9a.6.6 0 0 0-.6.4L7.2 11ZM8 13.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm8 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1 2v6l5 3 1-1.7-4-2.3V7h-2Z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm1 2.3 4 1.4v11.9l-4-1.4V6.3ZM5 7.4l3-1v11.9l-3 1V7.4Zm11 .3 3-1v11.9l-3 1V7.7Z',
  list: 'M4 6h2v2H4V6Zm4 0h12v2H8V6Zm-4 5h2v2H4v-2Zm4 0h12v2H8v-2Zm-4 5h2v2H4v-2Zm4 0h12v2H8v-2Z',
  locate: 'M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1V2Zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  route: 'M6 3a3 3 0 0 0-1 5.8V15a5 5 0 0 0 5 5h4.2a3 3 0 1 0 0-2H10a3 3 0 0 1-3-3V8.8A3 3 0 0 0 6 3Zm12-1-4 4 4 4V7h1a2 2 0 0 1 0 4h-3v2h3a4 4 0 0 0 0-8h-1V2Z',
  share: 'M18 3a3 3 0 0 0-2.9 3.8L8.9 10a3 3 0 1 0 0 4l6.2 3.2A3 3 0 1 0 16 15.4L9.8 12.2a3 3 0 0 0 0-.4L16 8.6A3 3 0 1 0 18 3Z',
  back: 'M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12l6.6-6.6Z',
  close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z',
  glass: 'M6 3h10v3h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V3Zm10 5v5h2V8h-2ZM8 5v14h6V5H8Z',
  door: 'M5 21V3h11l3 1v17h-2V5.4L16 5v16H5Zm2-2h7V5H7v14Zm4.5-8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-1 7h2v7h-2v-7Zm0-4h2v2h-2V6Z',
  check: 'm9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4-9.6 9.6Z',
  filter: 'M3 5h18v2l-7 7v5l-4 2v-7L3 7V5Z',
};

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** 사진이 없거나 로드 실패 시 중립적인 '사진 준비 중' 표시 (임의 생성 이미지 사용 안 함) */
export function VenueImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`img-placeholder ${className ?? ''}`} role="img" aria-label={`${alt} 사진 준비 중`}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v8.6l4-4 3 3 2-2 5 5V7H5Zm10.5 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
        <span>사진 준비 중</span>
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
}

export function OpenBadge({ venue, now }: { venue: PublicVenue; now?: Date }) {
  const s = statusLabel(getOpenStatus(venue, now));
  return (
    <span className={`status status-${s.tone}`}>
      <Icon name="clock" size={14} />
      {s.text}
    </span>
  );
}

export function beverageText(b: Beverage): string {
  return b.servingType === 'unknown' ? b.productName : `${b.productName} · ${SERVING_LABEL[b.servingType]}`;
}

/** 확인된 취급(available) 음료만 배지로. 최대 max개 + 더 보기 */
export function BeverageBadges({ beverages, max = 3, onMore }: { beverages: Beverage[]; max?: number; onMore?: () => void }) {
  const avail = beverages.filter((b) => b.availabilityStatus === 'available');
  if (!avail.length) return null;
  const shown = avail.slice(0, max);
  const rest = avail.length - shown.length;
  return (
    <ul className="bev-badges" aria-label="취급 음료 (확인된 정보)">
      {shown.map((b, i) => (
        <li key={`${b.productId}-${b.servingType}-${i}`} className="bev-badge">
          <Icon name="glass" size={13} />
          {beverageText(b)}
        </li>
      ))}
      {rest > 0 && (
        <li>
          {onMore ? (
            <button type="button" className="bev-badge bev-more" onClick={onMore}>+{rest} 더 보기</button>
          ) : (
            <span className="bev-badge bev-more">+{rest}</span>
          )}
        </li>
      )}
    </ul>
  );
}

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>데모 데이터</strong> 표시 중 — 가상 상호이며 실제 업소·메뉴·가격·위치가 아닙니다.
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'warn' ? 'alert' : 'status'}>
      <Icon name="info" size={16} />
      <div>{children}</div>
    </div>
  );
}
