// 강조 표시 대상 제품(카스·카스 0.0·한맥). 공식 로고를 재현하지 않고 색·아이콘·글자로만 구분한다.
// 강조는 "취급 정보"를 눈에 띄게 하는 것이며 업소 평가가 아니다.
import type { Beverage, PublicVenue } from '../../shared/types';

export const FEATURED_PRODUCTS = ['cass', 'cass-zero', 'hanmac'] as const;

export const BRAND_COLOR: Record<string, string> = {
  cass: '#1f4fa0',
  'cass-zero': '#1f7fae',
  hanmac: '#a87420',
};

export function featuredBeverages(v: Pick<PublicVenue, 'beverages'>): Beverage[] {
  return v.beverages.filter((b) => b.availabilityStatus === 'available' && (FEATURED_PRODUCTS as readonly string[]).includes(b.productId));
}

export const isFeatured = (v: Pick<PublicVenue, 'beverages'>) => featuredBeverages(v).length > 0;

/** 강조 배지에 쓰는 짧은 표기: "카스 생맥주", "카스 0.0", "한맥 병" */
export function featuredLabel(b: Beverage): string {
  const serving = b.servingType === 'draft' ? ' 생맥주' : b.servingType === 'bottle' ? ' 병' : b.servingType === 'can' ? ' 캔' : '';
  return `${b.productName}${serving}`;
}
