import catalog from '../../data/catalog/catalog.json';
import type { AreaId, ParkingType, PurposeTag, ServingType } from '../../shared/types';

export const areaLabel = (a: AreaId) => catalog.areas.find((x) => x.id === a)?.label ?? a;
export const purpose = (p: PurposeTag) => catalog.purposes.find((x) => x.id === p) ?? { id: p, label: p };

export function price(n: number | null): string | null {
  return n === null ? null : `${n.toLocaleString('ko-KR')}원`;
}

export const SERVING_LABEL: Record<ServingType, string> = {
  draft: '생맥주', bottle: '병', can: '캔', unknown: '제공 형태 확인 중',
};

export const PARKING_LABEL: Record<ParkingType, string> = {
  dedicated: '매장 전용 주차',
  building: '건물 주차',
  'public-nearby': '인근 공영주차',
  none: '주차 불가',
  unknown: '주차 정보 확인 필요',
};

export const PARKING_FEE_LABEL = { free: '무료', paid: '유료', conditional: '조건부 무료' } as const;

export function formatDate(d: string | null): string {
  if (!d) return '확인일 미상';
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}
