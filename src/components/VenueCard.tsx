import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { formatStraightDistance } from '../../shared/filter';
import type { PublicVenue } from '../../shared/types';
import { areaLabel, PARKING_LABEL, price, purpose } from '../lib/format';
import { BeverageBadges, Icon, OpenBadge, VenueImage } from './ui';
import { BrandMark } from './BrandMark';
import { featuredBeverages, featuredLabel } from '../lib/brand';

interface Props {
  venue: PublicVenue;
  selected: boolean;
  distanceM: number | null;
  showBeverages: boolean;
  onSelect(): void;
  /** 상세 링크에 붙일 쿼리 (source 등) */
  detailSearch: string;
  /** 300m 이내 주차장 수 */
  nearbyParkingCount: number;
}

export const VenueCard = forwardRef<HTMLElement, Props>(function VenueCard(
  { venue: v, selected, distanceM, showBeverages, onSelect, detailSearch, nearbyParkingCount },
  ref,
) {
  const menu = v.featuredMenus[0];
  const menuPrice = menu ? price(menu.price) : null;
  const featured = showBeverages ? featuredBeverages(v) : [];
  return (
    <article ref={ref} className={`venue-card${selected ? ' is-selected' : ''}${featured.length ? ' is-featured' : ''}`} aria-current={selected || undefined}>
      {featured.length > 0 && (
        <div className="featured-ribbon">
          <span className="featured-ribbon-title">카스·한맥 취급</span>
          <ul className="featured-list">
            {featured.map((b, i) => (
              <li key={`${b.productId}-${b.servingType}-${i}`} className={`featured-chip brand-${b.productId}`}>
                <BrandMark productId={b.productId} servingType={b.servingType} size={18} imageHeight={40} />
                {featuredLabel(b)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="venue-card-hit" onClick={onSelect} aria-label={`${v.name} 지도에서 보기`}>
        <VenueImage src={v.coverImage} alt={v.name} className="venue-card-img" />
        <div className="venue-card-body">
          <h3 className="venue-name">{v.name}</h3>
          <p className="venue-meta">
            {areaLabel(v.area)} · {v.category}
            {v.floor ? ` · ${v.floor}` : ''}
          </p>
          {menu && (
            <p className="venue-menu">
              {menu.name}
              {menuPrice ? <strong> {menuPrice}</strong> : <span className="muted"> 가격 확인 필요</span>}
            </p>
          )}
          {v.purposeTags.length > 0 && (
            <ul className="tag-row" aria-label="이용 목적">
              {v.purposeTags.slice(0, 3).map((t) => (
                <li key={t} className="tag">
                  <span aria-hidden="true">{purpose(t).icon}</span> {purpose(t).label}
                </li>
              ))}
            </ul>
          )}
          <div className="venue-facts">
            <OpenBadge venue={v} />
            <span className="fact">
              <Icon name="car" size={14} />
              {v.parkingType === 'unknown' && nearbyParkingCount > 0 ? `근처 주차장 ${nearbyParkingCount}곳` : PARKING_LABEL[v.parkingType]}
            </span>
            {distanceM !== null && (
              <span className="fact">
                <Icon name="pin" size={14} />
                {formatStraightDistance(distanceM)}
              </span>
            )}
            {v.latitude === null && <span className="fact muted">지도 위치 확인 중</span>}
          </div>
          {showBeverages && <BeverageBadges beverages={v.beverages.filter((b) => !featured.includes(b))} />}
        </div>
      </button>
      <Link className="btn btn-secondary venue-card-cta" to={{ pathname: `/venues/${v.slug}`, search: detailSearch }}>
        상세 보기
      </Link>
    </article>
  );
});
