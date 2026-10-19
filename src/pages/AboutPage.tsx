import { Link } from 'react-router-dom';
import { site } from '../config/site';

export function AboutPage() {
  return (
    <main className="page-pad prose">
      <Link to="/explore" className="text-link">← 업소 찾기로</Link>
      <h1 className="page-title">{site.name}</h1>
      <p>{site.tagline}</p>
      <h2>어떤 서비스인가요?</h2>
      <p>{site.disclosure}</p>
      <p>대상 지역: {site.regionLabel}</p>
      <h2>정보는 어떻게 정해지나요?</h2>
      <ul>
        <li>목록 순서는 운영자가 정한 공개 순서이며, 맛·인기 순위가 아닙니다.</li>
        <li>‘내 위치’를 허용하면 직선거리 순으로 볼 수 있습니다. 실제 이동 거리·시간과 다릅니다.</li>
        <li>‘운영 중’ 표시는 등록된 영업시간으로 계산한 값이며 실시간 영업을 보장하지 않습니다.</li>
        <li>음료 취급 정보는 업소가 확인한 제품 기준입니다. 확인되지 않은 정보는 표시하지 않습니다.</li>
        <li>별점·리뷰·방문자 수는 제공하지 않습니다.</li>
      </ul>
      <h2>개인정보</h2>
      <ul>
        <li>회원가입이 없으며, 내 위치는 이 화면에서 거리 계산에만 쓰이고 저장·전송되지 않습니다.</li>
        <li>서비스 개선을 위해 페이지 열람·길찾기 버튼 클릭 같은 이용 횟수를 개인을 식별하지 않는 방식으로 집계할 수 있습니다.</li>
      </ul>
      <p className="muted small">지도: 카카오맵</p>
    </main>
  );
}
