'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { Patient } from '@/types/api';

/** Value stored in the QR: a link to the lookup page holding only the opaque token. */
export function qrValue(token: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/health-card/${token}`;
}

/** Pulls the token out of anything we might scan: our link, the backend's link, or a bare token. */
export function tokenFromScan(text: string): string | null {
  const value = text.trim();
  const match = value.match(/health-card\/([A-Za-z0-9_\-]+)/);
  if (match) return match[1]!;
  return /^[A-Za-z0-9_\-]{16,}$/.test(value) ? value : null;
}

type CardPatient = Pick<Patient, 'name' | 'patient_code' | 'age' | 'gender' | 'village'>;

export function HealthCard({ patient, token }: { patient: CardPatient; token: string }) {
  return (
    <div className="print-card relative overflow-hidden rounded-xl bg-white ring-1 ring-line">
      <div className="absolute inset-y-0 left-0 w-2 bg-turmeric-500" />
      <div className="flex gap-4 py-5 pl-7 pr-5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-neem-700">SwasthyaAI health card</div>
          <div className="mt-2 truncate text-xl font-semibold leading-tight">{patient.name}</div>
          <div className="mt-0.5 font-medium tabular-nums tracking-wide text-muted">{patient.patient_code}</div>
          <div className="mt-3 text-sm">
            {patient.age} years, {patient.gender}
            <br />
            {patient.village}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <div className="rounded-md bg-white p-1.5 ring-1 ring-line">
            <QRCodeSVG value={qrValue(token)} size={108} fgColor="#123B2D" level="M" />
          </div>
          <span className="mt-1.5 text-xs text-muted">Scan to open record</span>
        </div>
      </div>
    </div>
  );
}
