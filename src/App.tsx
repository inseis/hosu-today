import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { captureSource, track } from './analytics/events';
import { DatasetProvider } from './hooks/useDataset';
import { AboutPage } from './pages/AboutPage';
import { ExplorePage } from './pages/ExplorePage';
import { VenuePage } from './pages/VenuePage';

// 관리자 화면은 별도 청크로 분리 — 고객 화면 번들에 포함되지 않음
const AdminApp = lazy(() => import('./admin/AdminApp'));

function LandingTracker() {
  const loc = useLocation();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || loc.pathname.startsWith('/admin')) return;
    done.current = true;
    captureSource(new URLSearchParams(loc.search));
    // 'QR 스캔 수'가 아니라 'QR 경로 접속 수' — 링크 공유로도 발생할 수 있음
    track('landing_view');
  }, [loc]);
  return null;
}

export function App() {
  const loc = useLocation();
  return (
    <>
      <LandingTracker />
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={<div className="page-loading">관리자 화면 불러오는 중…</div>}><AdminApp /></Suspense>} />
        <Route
          path="*"
          element={
            <DatasetProvider>
              <Routes>
                <Route path="/" element={<Navigate to={{ pathname: '/explore', search: loc.search }} replace />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/venues/:slug" element={<VenuePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="*" element={<main className="page-pad"><h1 className="page-title">페이지를 찾을 수 없습니다</h1><Link className="btn btn-primary" to="/explore">주변 업소 보기</Link></main>} />
              </Routes>
            </DatasetProvider>
          }
        />
      </Routes>
    </>
  );
}
