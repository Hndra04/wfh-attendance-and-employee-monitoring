export interface AdminUser {
  id: string;
  email: string;
  role: 'HRD_ADMIN';
  mustChangePassword: boolean;
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  department: string;
  position: string;
  joinDate: string;
  phone: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Attendance {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  status: 'PRESENT' | 'LATE';
  durationMinutes: number | null;
  employee: Pick<Employee, 'id' | 'fullName' | 'department'> | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardSummary {
  date: string;
  totalActiveEmployees: number;
  checkedIn: number;
  notCheckedIn: number;
  checkedOut: number;
  series: Array<{ date: string; total: number; present: number; late: number }>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3002/api/v1'
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
      expireSession();
      throw error;
    }
    return apiRequest<T>(path, init, true);
  }
  if (response.status === 401 && !isAuthRoute(path)) expireSession();
  if (!response.ok) throw await createApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiPhoto(path: string, retried = false): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path.replace(/^\/api\/v1/, '')}`, {
    headers: createHeaders(),
    credentials: 'include',
  });
  if (response.status === 401 && !retried) {
    try {
      await refreshAccessToken();
    } catch (error) {
      expireSession();
      throw error;
    }
    return apiPhoto(path, true);
  }
  if (response.status === 401) expireSession();
  if (!response.ok) throw await createApiError(response);
  return response.blob();
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

export function errorMessage(error: unknown): string {
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

function expireSession() {
  setAccessToken(null);
  onSessionExpired();
}

async function createApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Permintaan gagal.';
  let details: Array<{ field?: string; message: string }> | undefined;
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      details?: Array<{ field?: string; message: string }>;
    };
    if (Array.isArray(body.message)) message = body.message.join(' ');
    else if (body.message) message = body.message;
    details = body.details;
  } catch {
    // Keep the HTTP status message when a response has no JSON body.
  }
  return new ApiError(message, response.status, details);
}
