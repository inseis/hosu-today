import type { Venue, VenueOps } from './types';

// 비공개 운영 데이터 관련 로직. 서버와 관리자 화면에서만 사용 (고객 화면 번들에 포함하지 않음)

/** 게시 조건: 게시 ON + 게시 동의 + 검토 승인. 하나라도 빠지면 비공개 */
export function isPublicEligible(v: Venue, ops: VenueOps | undefined): boolean {
  return v.isPublished && ops?.consentStatus === 'agreed' && ops?.reviewStatus === 'approved';
}

export function publishBlockers(v: Venue, ops: VenueOps | undefined): string[] {
  const out: string[] = [];
  if (!ops || ops.consentStatus !== 'agreed') out.push('업소 게시 동의 미확인');
  if (!ops || ops.reviewStatus !== 'approved') out.push('게시 검토 미승인');
  if (v.latitude === null || v.longitude === null) out.push('좌표 미확인 (목록에는 표시, 지도 마커 없음)');
  return out;
}

export function emptyOps(venueId: string): VenueOps {
  return {
    venueId, consentStatus: 'pending', consentRecordedAt: null, reviewStatus: 'draft',
    verificationEvidence: null, staffNote: null, updatedAt: new Date().toISOString(),
  };
}
