// 강조 표시 대상 제품(카스·카스 0.0·한맥). 공식 로고를 재현하지 않고 색·아이콘·글자로만 구분한다.
// 강조는 "취급 정보"를 눈에 띄게 하는 것이며 업소 평가가 아니다.
import type { Beverage, PublicVenue } from '../../shared/types';

export const FEATURED_PRODUCTS = ['cass', 'cass-zero', 'hanmac'] as const;

export const BRAND_COLOR: Record<string, string> = {
  cass: '#1f4fa0',
  'cass-zero': '#1f7fae',
  hanmac: '#a87420',
};

/** 강조 띠·지도 강조 마커 대상: 카스 생맥주·카스 0.00·한맥 (카스 병은 대부분 업소가 취급해 은은하게만 표시) */
export function featuredBeverages(v: Pick<PublicVenue, 'beverages'>): Beverage[] {
  return v.beverages.filter((b) => b.availabilityStatus === 'available'
    && (FEATURED_PRODUCTS as readonly string[]).includes(b.productId)
    && !(b.productId === 'cass' && b.servingType === 'bottle'));
}

export function hasCassBottle(v: Pick<PublicVenue, 'beverages'>): boolean {
  return v.beverages.some((b) => b.availabilityStatus === 'available' && b.productId === 'cass' && b.servingType === 'bottle');
}

/** 상세 화면 취급 목록 순서: 카스 계열 → 한맥 → 그 외 */
const ORDER = ['cass', 'cass-zero', 'cass-lemon-squeeze-zero', 'hanmac'];
export function sortBeverages(list: Beverage[]): Beverage[] {
  const rank = (b: Beverage) => { const i = ORDER.indexOf(b.productId); return i < 0 ? 99 : i; };
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.servingType === 'draft' ? -1 : 1));
}

export const isFeatured = (v: Pick<PublicVenue, 'beverages'>) => featuredBeverages(v).length > 0;

/** 강조 배지에 쓰는 짧은 표기: "카스 생맥주", "카스 0.0", "한맥 병" */
export function featuredLabel(b: Beverage): string {
  const serving = b.servingType === 'draft' ? ' 생맥주' : b.servingType === 'bottle' ? ' 병' : b.servingType === 'can' ? ' 캔' : '';
  return `${b.productName}${serving}`;
}

/**
 * 운영자가 제공한 공식 제품 이미지 (public/images/brands).
 * 이미지가 없는 조합(예: 카스 생맥주)은 null → 아이콘으로 표시
 */
export function brandImage(b: Pick<Beverage, 'productId' | 'servingType'>): string | null {
  if (b.productId === 'cass-zero') return 'cass-zero-bottle.png';
  if (b.productId === 'cass' && b.servingType === 'bottle') return 'cass-bottle.png';
  if (b.productId === 'hanmac') return b.servingType === 'draft' ? 'hanmac-draft.png' : 'hanmac-bottle.png';
  return null;
}
