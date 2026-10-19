// 관리자 API 클라이언트. 인증은 서버의 httpOnly 쿠키로만 처리한다.
export class ApiError extends Error {
  constructor(public status: number, public errors: string[]) {
    super(errors.join('\n'));
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api/admin${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'hosu-admin',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const ct = r.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await r.json() : null;
  if (!r.ok) throw new ApiError(r.status, data?.errors ?? [data?.error ?? `요청 실패 (HTTP ${r.status})`]);
  return data as T;
}
