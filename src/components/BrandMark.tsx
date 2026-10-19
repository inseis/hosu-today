import { BRAND_COLOR } from '../lib/brand';

/** 브랜드 색 맥주잔 아이콘 (공식 로고 아님). 공식 로고 파일을 받으면 여기서 교체 */
export function BrandMark({ productId, size = 16 }: { productId: string; size?: number }) {
  const c = BRAND_COLOR[productId] ?? '#5f6879';
  const zero = productId === 'cass-zero';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h10v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" fill={zero ? '#fff' : c} stroke={c} strokeWidth="1.6" />
      <path d="M15 9h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15" fill="none" stroke={c} strokeWidth="1.8" />
      <path d="M4.5 6.5c0-2 1.6-3 3-3 .7-1 1.8-1.5 3-1.2 1-.6 2.6-.4 3.5.6 1.3 0 2 1.2 1.6 2.4" fill="#fff" stroke={c} strokeWidth="1.4" />
      {zero && <text x="10" y="17" textAnchor="middle" fontSize="7" fontWeight="800" fill={c}>0.0</text>}
    </svg>
  );
}
