let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(cb: () => void): void {
  onUnauthorizedCallback = cb;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/bootstrap')) {
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  }

  const contentType = res.headers.get('Content-Type') || '';
  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    if (contentType.includes('application/json')) {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) errorMessage = payload.error;
    }
    throw new ApiError(errorMessage, res.status);
  }

  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export async function downloadAuthorizedFile(url: string, filename: string): Promise<void> {
  const headers = new Headers();
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new ApiError('Failed to download file.', res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
