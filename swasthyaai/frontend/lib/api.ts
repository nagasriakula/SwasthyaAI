import type {
  AnalyzeResponse,
  AnmDashboard,
  AshaDashboard,
  CreatedScreening,
  FollowUp,
  FollowUpPriority,
  FollowUpStatus,
  HealthCardCreated,
  HealthCardRecord,
  Patient,
  PatientInput,
  PatientUpdateInput,
  Screening,
  ScreeningResult,
  ScreeningType,
  TokenResponse,
  User,
  UserCreateInput,
} from '@/types/api';

/**
 * All backend calls go through apiFetch. Requests use relative paths
 * (/api/...), which next.config.mjs forwards to FastAPI.
 */

const TOKEN_KEY = 'swasthyaai_token';

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  /** Raw `detail` from FastAPI, e.g. the image-quality failure object. */
  detail: unknown;
  constructor(status: number, message: string, detail: unknown = null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when the backend rejects the token (expired or invalid). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  form?: FormData;
  query?: Query;
  auth?: boolean;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was not accepted. Check the details and try again.',
  401: 'Your session has ended. Sign in again.',
  403: 'Your account does not have permission for this.',
  404: 'The record was not found.',
  413: 'The file is too large.',
  422: 'Some details are missing or invalid.',
  500: 'The server had a problem. Try again in a moment.',
};

function messageFrom(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc, msg, type }]
    const msgs = detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : '';
        return d?.msg ? `${field ? `${field}: ` : ''}${d.msg}` : null;
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join('. ');
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: unknown }).message);
  }
  return STATUS_MESSAGES[status] || `Request failed (${status}).`;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', json, form, query, auth = true } = opts;

  let url = path;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the SwasthyaAI server. Check the connection and that the backend is running.');
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      tokenStore.clear();
      unauthorizedHandler?.();
    }
    if (res.status >= 500 && !data) {
      throw new ApiError(res.status, 'The backend is not responding. Make sure FastAPI is running on port 8000.');
    }
    throw new ApiError(res.status, messageFrom(data, res.status), (data as { detail?: unknown } | null)?.detail ?? null);
  }

  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<TokenResponse>('/api/auth/login', { method: 'POST', json: { email, password }, auth: false }),

  me: () => apiFetch<User>('/api/auth/me'),

  ashaDashboard: () => apiFetch<AshaDashboard>('/api/dashboard/asha'),

  // ---------- Health worker accounts (ADMIN only) ----------
  users: () => apiFetch<User[]>('/api/auth/users'),
  createUser: (data: UserCreateInput) => apiFetch<User>('/api/auth/users', { method: 'POST', json: data }),
  setUserActive: (id: number, active: boolean) =>
    apiFetch<User>(`/api/auth/users/${id}/status`, { method: 'PUT', json: { active } }),
  /** Admin: move an ASHA worker under another ANM (her patients move with her). */
  setUserAnm: (id: number, anm_id: number | null) =>
    apiFetch<User>(`/api/auth/users/${id}/anm`, { method: 'PUT', json: { anm_id } }),
  /** ANM: the ASHA workers she supervises. */
  myAshas: () => apiFetch<User[]>('/api/auth/my-ashas'),

  anmDashboard: () => apiFetch<AnmDashboard>('/api/dashboard/anm'),

  // ---------- Patients (routes are declared as "/" so the trailing slash matters) ----------
  patients: () => apiFetch<Patient[]>('/api/patients/'),
  patient: (id: number) => apiFetch<Patient>(`/api/patients/${id}`),
  createPatient: (data: PatientInput) => apiFetch<Patient>('/api/patients/', { method: 'POST', json: data }),
  updatePatient: (id: number, data: PatientUpdateInput) =>
    apiFetch<Patient>(`/api/patients/${id}`, { method: 'PUT', json: data }),

  // ---------- Screenings ----------
  // The backend reads these as query parameters, not a JSON body.
  createScreening: (patientId: number, type: ScreeningType, symptoms?: string) =>
    apiFetch<{ message: string; screening: CreatedScreening }>('/api/screenings', {
      method: 'POST',
      query: { patient_id: patientId, screening_type: type, symptoms },
    }),

  analyzeScreening: (screeningId: number, image: Blob, filename: string, symptoms?: string) => {
    const form = new FormData();
    form.append('image', image, filename);
    if (symptoms) form.append('symptoms', symptoms);
    return apiFetch<AnalyzeResponse>(`/api/screenings/${screeningId}/analyze`, { method: 'POST', form });
  },

  screening: (id: number) => apiFetch<Screening>(`/api/screenings/${id}`),
  screeningResult: (id: number) => apiFetch<ScreeningResult>(`/api/screenings/${id}/result`),

  // ---------- Follow-ups (query parameters) ----------
  followups: (status?: FollowUpStatus) =>
    apiFetch<{ count: number; followups: FollowUp[] }>('/api/followups', { query: { status } }),

  createFollowup: (data: {
    patient_id: number;
    scheduled_date: string;
    screening_id?: number | null;
    assigned_to_user_id?: number | null;
    priority?: FollowUpPriority;
    notes?: string;
  }) => apiFetch<{ message: string; followup: FollowUp }>('/api/followups', { method: 'POST', query: data }),

  updateFollowup: (
    id: number,
    data: {
      status?: FollowUpStatus;
      scheduled_date?: string;
      priority?: FollowUpPriority;
      notes?: string;
      assigned_to_user_id?: number;
    }
  ) => apiFetch<unknown>(`/api/followups/${id}`, { method: 'PUT', query: data }),

  // ---------- Health card / QR ----------
  // Returns the existing card if the patient already has one.
  createHealthCard: (patientId: number) =>
    apiFetch<HealthCardCreated>(`/api/healthcard/${patientId}`, { method: 'POST' }),
  healthCard: (token: string) => apiFetch<HealthCardRecord>(`/api/health-card/${encodeURIComponent(token)}`),
};

/** Turns a backend file path (e.g. "uploads\\gradcam\\x.jpg") into a URL served via the /uploads proxy. */
export function fileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const clean = path.replace(/\\/g, '/').replace(/^\.?\//, '');
  const idx = clean.indexOf('uploads/');
  return '/' + (idx >= 0 ? clean.slice(idx) : clean);
}
