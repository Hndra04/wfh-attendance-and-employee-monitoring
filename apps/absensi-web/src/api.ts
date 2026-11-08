export interface EmployeeProfile {
  id: string;
  fullName: string;
  department: string;
  position: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: 'EMPLOYEE';
  mustChangePassword: boolean;
  employee: EmployeeProfile | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInPhotoUrl: string;
  checkOutPhotoUrl: string | null;
  notes: string | null;
  status: 'PRESENT' | 'LATE';
  durationMinutes: number | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'
).replace(/\/+$/, '');

let accessToken: string | null = null;
let refreshRequest: Promise<string> | null = null;
let onSessionExpired: () => void = () => {};

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: createHeaders(init.headers),
    credentials: 'include',
  });

  if (response.status === 401 && !isAuthRoute(path) && !retried) {
    try {
      await refreshAccessToken();
    } catch (error) {
      setAccessToken(null);
      onSessionExpired();
      throw error;
    }
    return apiRequest<T>(path, init, true);
  }

  if (response.status === 401 && !isAuthRoute(path)) {
    setAccessToken(null);
    onSessionExpired();
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function apiPhoto(path: string, retried = false): Promise<Blob> {
  const url = `${API_BASE_URL}${path.replace(/^\/api\/v1/, '')}`;
  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include',
  });

  if (response.status === 401 && !retried) {
    try {
      await refreshAccessToken();
    } catch (error) {
      setAccessToken(null);
      onSessionExpired();
      throw error;
    }
    return apiPhoto(path, true);
  }
  if (response.status === 401) {
    setAccessToken(null);
    onSessionExpired();
  }
  if (!response.ok) {
    throw await createApiError(response);
  }
  return response.blob();
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.';
}

function createHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  if (accessToken) result.set('Authorization', `Bearer ${accessToken}`);
  return result;
}

function isAuthRoute(path: string): boolean {
  return ['/auth/login', '/auth/refresh', '/auth/logout'].includes(path);
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw await createApiError(response);
        const result = (await response.json()) as { accessToken: string };
        setAccessToken(result.accessToken);
        return result.accessToken;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

async function createApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Permintaan gagal.';
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      message = body.message.join(' ');
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    // Keep the HTTP status message when a response has no JSON body.
  }
  return new ApiError(message, response.status);
}
