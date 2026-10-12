/**
 * Types that mirror the FastAPI backend responses.
 * Keep these in sync with backend/app/schemas and routers (see docs/api.md).
 */

export type Role = 'ASHA' | 'ANM' | 'ADMIN';
export type AppRole = 'ASHA' | 'ANM' | 'ADMIN';

export type RiskLevel = 'HIGH' | 'MODERATE' | 'LOW';
export type ScreeningType = 'ANEMIA' | 'JAUNDICE' | 'SKIN';
export type ScreeningStatus = 'PENDING' | 'ANALYZED' | 'QUALITY_FAILED' | string;
export type FollowUpStatus = 'PENDING' | 'DUE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';

/** POST /api/auth/login */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

/** GET /api/auth/me */
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  village: string | null;
  phone: string | null;
  active: boolean;
  /** Supervising ANM of an ASHA worker; null for ANM and Admin. */
  anm_id?: number | null;
}

/** GET /api/patients/ */
export interface Patient {
  id: number;
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  guardian_name: string | null;
  contact: string | null;
  symptoms: string | null;
  medical_history: string | null;
  registered_by: number;
}

/** Items in recent_screenings of both dashboards */
export interface DashboardScreening {
  id: number;
  patient_id: number;
  screening_type: ScreeningType;
  status: ScreeningStatus;
  screening_date: string;
  prediction: string | null;
  confidence: number | null;
  risk_level: RiskLevel | null;
}

/** Items in recent_followups of both dashboards */
export interface DashboardFollowUp {
  id: number;
  patient_id: number;
  screening_id: number | null;
  assigned_to_user_id: number | null;
  status: FollowUpStatus;
  priority: string;
  scheduled_date: string;
  completed_date: string | null;
  notes: string | null;
}

interface DashboardCommon {
  user: { id: number; name: string; email: string; role: Role };
  screenings: {
    total: number;
    pending: number;
    analyzed: number;
    quality_failed: number;
    jaundice: number;
    skin: number;
    anemia: number;
  };
  risk: { high: number; moderate: number; low: number };
  followups: {
    total: number;
    pending: number;
    due: number;
    overdue: number;
    completed: number;
    cancelled: number;
  };
  recent_screenings: DashboardScreening[];
  recent_followups: DashboardFollowUp[];
}

/** GET /api/dashboard/asha */
export interface AshaDashboard extends DashboardCommon {
  dashboard: 'ASHA';
  summary: { my_screenings: number; my_followups: number };
}

/** GET /api/dashboard/anm */
export interface AnmDashboard extends DashboardCommon {
  dashboard: 'ANM';
  summary: { total_patients: number; total_screenings: number; total_followups: number };
}

export type FollowUpPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/** POST /api/patients/ body (PatientCreate) */
export interface PatientInput {
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  guardian_name?: string | null;
  contact?: string | null;
  symptoms?: string | null;
  medical_history?: string | null;
}

/** PUT /api/patients/{id} body (PatientUpdate); every field optional */
export type PatientUpdateInput = Partial<Omit<PatientInput, 'patient_code'>>;

/** POST /api/screenings -> { message, screening } */
export interface CreatedScreening {
  id: number;
  patient_id: number;
  screening_type: ScreeningType;
  symptoms: string | null;
  status: ScreeningStatus;
  created_by: number;
  created_at: string;
}

/** GET /api/screenings/{id} */
export interface Screening {
  id: number;
  patient_id: number;
  created_by: number;
  screening_type: ScreeningType;
  symptoms: string | null;
  status: ScreeningStatus;
  screening_date: string;
  created_at: string;
  image_reference: string | null;
  image_filename: string | null;
  image_size: number | null;
  image_width: number | null;
  image_height: number | null;
}

/** POST /api/screenings/{id}/analyze (success) */
export interface AnalyzeResponse {
  message: string;
  screening: { id: number; patient_id: number; screening_type: ScreeningType; status: ScreeningStatus };
  image: {
    filename: string;
    size: number;
    width: number;
    height: number;
    path: string;
    quality: { status: string; reason_code: string; message: string; metrics?: Record<string, number> | null };
  };
  inference: { prediction: string; confidence: number; class_index: number; screening_type: string; model_version: string };
  risk: { risk_level: RiskLevel; reason: string; risk_engine_version: string };
  gradcam: { generated: boolean; path: string | null; error?: string };
}

/** 422 detail from analyze when the image fails the quality check */
export interface QualityFailure {
  message: string;
  quality_status: string;
  reason_code: string;
  recapture_guidance: string;
  metrics?: Record<string, number> | null;
}

/** GET /api/screenings/{id}/result */
export interface ScreeningResult {
  id: number;
  screening_id: number;
  prediction: string;
  confidence: number;
  risk_level: RiskLevel;
  risk_engine_version: string | null;
  risk_reason: string | null;
  model_version: string | null;
  gradcam_path: string | null;
  explanation: string | null;
  created_at: string;
}

/** Items of GET /api/followups and the follow-up returned by POST/PUT */
export interface FollowUp {
  id: number;
  patient_id: number;
  screening_id: number | null;
  assigned_to_user_id: number | null;
  status: FollowUpStatus;
  priority: FollowUpPriority | string;
  scheduled_date: string;
  completed_date: string | null;
  notes: string | null;
  created_at?: string;
}

/** POST /api/healthcard/{patient_id} */
export interface HealthCardCreated {
  message: string;
  health_card: { id: number; patient_id: number; token: string; qr_path: string | null; created_at: string };
}

/** GET /api/health-card/{token} */
export interface HealthCardRecord {
  health_card: { id: number; created_at: string };
  patient: Pick<Patient, 'id' | 'patient_code' | 'name' | 'age' | 'gender' | 'village' | 'guardian_name'>;
  screenings: {
    id: number;
    screening_type: ScreeningType;
    status: ScreeningStatus;
    screening_date: string;
    prediction: string | null;
    confidence: number | null;
    risk_level: RiskLevel | null;
    model_version: string | null;
  }[];
  followups: Omit<FollowUp, 'patient_id'>[];
}

/** POST /api/auth/users (admin only) */
export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  role: 'ASHA' | 'ANM';
  village?: string | null;
  phone?: string | null;
  /** Required for ASHA: the ANM who supervises her. */
  anm_id?: number | null;
}
