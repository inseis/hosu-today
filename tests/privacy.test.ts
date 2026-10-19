import { describe, expect, it } from 'vitest';
import { toPublicVenue } from '../shared/venue';
import { emptyOps, isPublicEligible } from '../shared/ops';
import { venue } from './fixtures';

describe('공개 데이터 허용 목록', () => {
  it('저장소에 섞인 비공개 필드는 공개 응답에 포함되지 않는다', () => {
    const raw = { ...venue({ id: 'x' }), businessNumber: '123-45-67890', pocCode: 'P001', ownerPhone: '010-0000-0000', staffNote: '메모' } as never;
    const pub = toPublicVenue(raw) as Record<string, unknown>;
    for (const k of ['businessNumber', 'pocCode', 'ownerPhone', 'staffNote', 'isPublished']) expect(pub).not.toHaveProperty(k);
  });

  it('미취급 확인 음료는 공개하지 않고, 미확인은 미확인으로 유지', () => {
    const v = venue({ id: 'x', beverages: [
      { productId: 'cass', brand: '카스', productName: '카스 후레쉬', servingType: 'bottle', volumeMl: null, price: null, availabilityStatus: 'unavailable', verifiedAt: null },
      { productId: 'cass-zero', brand: '카스', productName: '카스 0.0', servingType: 'bottle', volumeMl: null, price: null, availabilityStatus: 'unverified', verifiedAt: null },
    ] });
    const pub = toPublicVenue(v);
    expect(pub.beverages.map((b) => b.productName)).toEqual(['카스 0.0']);
    expect(pub.beverages[0].availabilityStatus).toBe('unverified');
  });

  it('null 가격·좌표는 0으로 바뀌지 않는다', () => {
    const pub = toPublicVenue(venue({ id: 'x', latitude: null, longitude: null, featuredMenus: [{ name: 'a', price: null, description: null, image: null, verifiedAt: null }, { name: 'b', price: 0, description: null, image: null, verifiedAt: null }] }));
    expect(pub.latitude).toBeNull();
    expect(pub.featuredMenus.map((m) => m.price)).toEqual([null, 0]);
  });

  it('위험한 이미지 URL은 제거', () => {
    expect(toPublicVenue(venue({ id: 'x', coverImage: 'javascript:alert(1)' })).coverImage).toBeNull();
  });

  it('게시 조건: 게시 ON + 동의 + 승인', () => {
    const v = venue({ id: 'x', isPublished: true });
    expect(isPublicEligible(v, undefined)).toBe(false);
    expect(isPublicEligible(v, { ...emptyOps('x'), consentStatus: 'agreed' })).toBe(false);
    expect(isPublicEligible(v, { ...emptyOps('x'), consentStatus: 'agreed', reviewStatus: 'approved' })).toBe(true);
    expect(isPublicEligible({ ...v, isPublished: false }, { ...emptyOps('x'), consentStatus: 'agreed', reviewStatus: 'approved' })).toBe(false);
  });
});
