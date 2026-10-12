import type { FollowUpStatus, RiskLevel, ScreeningType } from '@/types/api';

export const SCREENING_LABEL: Record<ScreeningType, string> = {
  ANEMIA: 'Anaemia',
  JAUNDICE: 'Jaundice',
  SKIN: 'Skin',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
};

export const RISK_ORDER: Record<RiskLevel, number> = { HIGH: 0, MODERATE: 1, LOW: 2 };

export const FOLLOWUP_LABEL: Record<FollowUpStatus, string> = {
  PENDING: 'Upcoming',
  DUE: 'Due today',
  OVERDUE: 'Overdue',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPercent(confidence: number | null | undefined) {
  if (confidence === null || confidence === undefined) return '';
  const pct = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(pct)}%`;
}

/** Days from today to the given date (negative = in the past). */
export function daysFromToday(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function whenText(iso: string) {
  const d = daysFromToday(iso);
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
}

/** Turns model labels like "Normal_Eye" into "Normal eye". */
export function readableLabel(label: string | null | undefined) {
  if (!label) return '';
  const s = label.replace(/_/g, ' ').trim();
  return s.length <= 3 ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/* ---------------- Screening configuration ---------------- */

export interface ScreeningOption {
  type: ScreeningType;
  title: string;
  bodyArea: 'eye' | 'skin';
  photo: string;
  guidance: string[];
}

export const SCREENING_OPTIONS: ScreeningOption[] = [
  {
    type: 'ANEMIA',
    title: 'Anaemia',
    bodyArea: 'eye',
    photo: 'Inner lower eyelid (conjunctiva)',
    guidance: [
      'Gently pull the lower eyelid down so the inner pink area shows.',
      'Use daylight. Do not use the flash.',
      'Hold the phone about 10–15 cm away and keep it steady.',
    ],
  },
  {
    type: 'JAUNDICE',
    title: 'Jaundice',
    bodyArea: 'eye',
    photo: 'White of the eye (sclera)',
    guidance: [
      'Ask the person to look up so the white of the eye shows.',
      'Use natural daylight; yellow indoor light changes the colour.',
      'Fill the frame with the eye and keep it in focus.',
    ],
  },
  {
    type: 'SKIN',
    title: 'Skin condition',
    bodyArea: 'skin',
    photo: 'Affected skin area',
    guidance: [
      'Photograph only the affected patch, about 15 cm away.',
      'Use daylight and avoid shadows on the skin.',
      'Keep the patch in the centre of the frame and in focus.',
    ],
  },
];

/**
 * Skin model classes from backend/app/ml/inference.py.
 * CONFIRM these full names with the ML dataset before the demo; until a name is
 * filled in, the screen shows the class code.
 */
export const SKIN_CLASS_NAMES: Record<string, string> = {
  AD: 'Atopic dermatitis',
  CD: 'Contact dermatitis',
  EC: 'Eczema',
  SC: 'Scabies',
  SD: 'Seborrheic dermatitis',
  TC: 'Tinea corporis (fungal infection)',
};

export function predictionLabel(prediction: string | null | undefined, type?: ScreeningType) {
  if (!prediction) return '';
  if (type === 'SKIN' || /^[A-Z]{2}$/.test(prediction)) {
    const name = SKIN_CLASS_NAMES[prediction];
    return name ? `${name} (${prediction})` : `Skin class ${prediction}`;
  }
  if (prediction === 'Normal_Eye') return 'Normal eye';
  return readableLabel(prediction);
}

export const SYMPTOM_OPTIONS = [
  'Tiredness / weakness',
  'Dizziness',
  'Breathlessness',
  'Pale skin or eyelids',
  'Yellow eyes',
  'Yellow skin',
  'Dark urine',
  'Fever',
  'Loss of appetite',
  'Stomach pain',
  'Itching',
  'Rash',
  'Ring-shaped patch',
  'Scaling / dry skin',
  'Blisters or boils',
];

/** Splits a stored symptom string ("a, b; c") into a list. */
export function splitList(value: string | null | undefined) {
  return (value || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * General next-step guidance shown with a result (PRD §15).
 * Rule-based and NOT a prescription; the backend has no recommendation endpoint yet.
 */
export function recommendations(type: ScreeningType, risk: RiskLevel, prediction: string): string[] {
  const normal = prediction === 'Normal_Eye';
  const out: string[] = [];
  if (risk === 'HIGH' && !normal) out.push('Refer for ANM review promptly. The ANM decides on any referral to a doctor or PHC.');
  if (risk === 'MODERATE') out.push('Schedule a follow-up visit within 7 days and screen again.');
  if (risk === 'LOW' || normal) out.push('Routine monitoring. Screen again at the next scheduled visit or if symptoms appear.');

  if (type === 'ANEMIA') {
    out.push('Encourage iron-rich foods: green leafy vegetables, jaggery, pulses, dates, eggs or meat where eaten.');
    out.push('Check that pregnant women and adolescent girls are taking IFA tablets as advised.');
  }
  if (type === 'JAUNDICE' && !normal) {
    out.push('Advise boiled or safe drinking water and plenty of fluids; avoid alcohol and unprescribed medicines.');
    out.push('Watch for warning signs: very dark urine, pale stools, vomiting, confusion or high fever.');
  }
  if (type === 'SKIN') {
    out.push('Keep the area clean and dry; do not share towels, clothes or bedding.');
    out.push('Avoid applying steroid creams without advice from a health worker or doctor.');
  }
  return out;
}

/** Patient codes are unique in the backend; this makes a readable, low-collision code. */
export function generatePatientCode() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `SW-${ymd}-${rand}`;
}

/** yyyy-mm-dd for <input type="date">, n days from today. */
export function dateInputValue(daysAhead = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The backend expects a datetime; a yyyy-mm-dd value becomes 9 AM that day. */
export function toBackendDate(dateInput: string) {
  return `${dateInput}T09:00:00`;
}
