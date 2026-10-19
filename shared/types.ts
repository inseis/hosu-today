// 고객 공개 데이터와 비공개 운영 데이터의 타입 정의.
// 원칙: 모르는 값은 null(미확인)로 두고, 0이나 빈 문자열로 대체하지 않는다.

export type AreaId = 'lafesta' | 'westerndom' | 'lakepark';

export type PurposeTag = 'meal' | 'light-snack' | 'group' | 'quiet-talk';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** "HH:MM" 24시간 표기. close가 open보다 이르거나 같으면 자정을 넘는 영업으로 해석 */
export interface TimeRange {
  open: string;
  close: string;
}

/**
 * 요일별 영업시간.
 * - TimeRange[] (1개 이상): 해당 요일 영업
 * - []: 정기 휴무로 확인됨
 * - null: 미확인
 */
export type WeeklyHours = Record<DayKey, TimeRange[] | null>;

export interface BreakTime {
  days: DayKey[];
  start: string;
  end: string;
}

export interface TemporaryClosure {
  /** YYYY-MM-DD, 양 끝 포함 */
  startDate: string;
  endDate: string;
  reason: string | null;
}

export type ParkingType = 'dedicated' | 'building' | 'public-nearby' | 'none' | 'unknown';

export type ServingType = 'draft' | 'bottle' | 'can' | 'unknown';

/** available: 취급 확인 / unavailable: 미취급 확인(고객 화면 미표시) / unverified: 미확인 */
export type AvailabilityStatus = 'available' | 'unavailable' | 'unverified';

export interface FeaturedMenu {
  name: string;
  /** 원 단위. null = 가격 미확인 */
  price: number | null;
  description: string | null;
  image: string | null;
  verifiedAt: string | null;
}

export interface Beverage {
  /** data/catalog/beverages.json의 product id */
  productId: string;
  brand: string;
  /** 업소에서 확인한 정확한 제품명 (예: "카스 0.0") */
  productName: string;
  servingType: ServingType;
  volumeMl: number | null;
  price: number | null;
  availabilityStatus: AvailabilityStatus;
  verifiedAt: string | null;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  area: AreaId;
  category: string;
  description: string | null;
  address: string | null;
  addressDetail: string | null;
  latitude: number | null;
  longitude: number | null;
  kakaoPlaceId: string | null;
  /** 업소 대표 공개 번호만. 점주 개인 번호 금지 */
  publicPhone: string | null;
  coverImage: string | null;
  images: string[];
  purposeTags: PurposeTag[];
  featuredMenus: FeaturedMenu[];
  weeklyHours: WeeklyHours | null;
  breakTimes: BreakTime[];
  temporaryClosures: TemporaryClosure[];
  parkingType: ParkingType;
  parkingFee: 'free' | 'paid' | 'conditional' | null;
  parkingDescription: string | null;
  parkingCapacity: number | null;
  entranceDescription: string | null;
  floor: string | null;
  beverages: Beverage[];
  displayOrder: number;
  isPublished: boolean;
  informationVerifiedAt: string | null;
}

/** 공개 응답에 포함되는 업소 (isPublished 등 운영 필드 일부 제거) */
export type PublicVenue = Omit<Venue, 'isPublished'>;

/** 비공개 운영 데이터 — 공개 API/번들에 절대 포함하지 않음 */
export interface VenueOps {
  venueId: string;
  consentStatus: 'pending' | 'agreed' | 'withdrawn';
  consentRecordedAt: string | null;
  reviewStatus: 'draft' | 'in_review' | 'approved' | 'rejected';
  verificationEvidence: string | null;
  staffNote: string | null;
  updatedAt: string;
}

export interface Campaign {
  /** QR 주소의 source 값 */
  id: string;
  label: string;
  /** /explore 또는 /venues/{slug} */
  targetPath: string;
  placement: string | null;
  active: boolean;
  createdAt: string;
}

export interface Notice {
  id: string;
  text: string;
  /** ISO 날짜시간. 기간 밖이면 자동 숨김 */
  startAt: string;
  endAt: string;
  /** 운영 담당자 문구 검토 완료 여부 */
  approved: boolean;
}

export interface SiteSettings {
  notices: Notice[];
  /** 고객 화면에 음료 브랜드 배지·필터 노출 여부 (운영 담당자 검토 후 켬) */
  showBeverageInfo: boolean;
  /** 운영자가 설정한 지역 중심점 (공개 업소가 없을 때 사용) */
  mapCenter: { latitude: number; longitude: number; level: number };
  /** 오류 제보 대체 연락 수단 (공개 이메일 등) */
  contactEmail: string | null;
}

export interface ErrorReport {
  id: string;
  venueId: string;
  kind: 'hours' | 'menu' | 'location' | 'parking' | 'beverage' | 'closed' | 'other';
  message: string;
  createdAt: string;
  resolved: boolean;
}

export type AnalyticsEventName =
  | 'landing_view'
  | 'filter_apply'
  | 'venue_open'
  | 'directions_click'
  | 'menu_open'
  | 'share_click';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  venueId: string | null;
  source: string | null;
  timestamp: string;
  filterSummary: string | null;
}
