/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_KAKAO_MAP_JAVASCRIPT_KEY?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_SITE_NAME?: string;
  readonly VITE_PUBLIC_BASE_URL?: string;
  readonly VITE_PUBLIC_DATA_URL?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}
