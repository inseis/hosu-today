import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages처럼 하위 경로(/저장소명/)에 배포할 때: VITE_BASE_PATH=/hosu-today/
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5173,
    // 개발 중에는 API 서버(기본 8787)로 프록시
    proxy: { '/api': 'http://localhost:8787' },
  },
  // 상위 폴더의 PostCSS 설정을 읽지 않도록 고정
  css: { postcss: {} },
  build: { sourcemap: false },
});
