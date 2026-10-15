export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let cachedCsrfToken: string | null = null;

const BASE_URL = import.meta.env.DEV ? '/api/v1' : (import.meta.env.VITE_API_BASE_URL || '/api/v1');

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  const res = await fetch(`${BASE_URL}/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new ApiError(res.status, 'CSRF_FETCH_FAILED', 'Failed to retrieve CSRF token');
  }

  const data = (await res.json()) as { csrfToken: string };
  cachedCsrfToken = data.csrfToken;
  return cachedCsrfToken;
}

export function clearCachedCsrfToken(): void {
  cachedCsrfToken = null;
}

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    const token = await getCsrfToken();
    headers.set('x-csrf-token', token);
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorData: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      errorData = await res.json();
    } catch {
      // Non-json response
    }

    const code = errorData.error?.code || (res.status === 401 ? 'UNAUTHORIZED' : 'REQUEST_FAILED');
    const message = errorData.error?.message || `Request failed with status ${res.status}`;

    // If CSRF token was invalid/expired, reset cache and retry once
    if (code === 'CSRF_FAILED' && !isRetry) {
      clearCachedCsrfToken();
      return fetchApi<T>(path, options, true);
    }

    throw new ApiError(res.status, code, message, errorData.error?.details);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}
