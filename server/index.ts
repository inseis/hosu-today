try {
  process.loadEnvFile('.env');
} catch {
  // .env 없이 환경변수만으로도 실행 가능
}

const { createApp } = await import('./app');
const { authConfigured } = await import('./auth');
const { DATA_DIR } = await import('./store');

const port = Number(process.env.PORT || 8787);
createApp().listen(port, () => {
  console.log(`[api] http://localhost:${port}  (data: ${DATA_DIR})`);
  if (!authConfigured()) console.warn('[api] 관리자 계정 미설정: ADMIN_PASSWORD_HASH, SESSION_SECRET 을 .env 에 설정하세요.');
  console.log(`[api] 이벤트 집계 저장: ${process.env.ANALYTICS_ENABLED === 'true' ? 'ON' : 'OFF'}`);
});
export {};
