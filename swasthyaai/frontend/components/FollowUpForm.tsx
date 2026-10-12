'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dateInputValue, toBackendDate } from '@/lib/format';
import type { FollowUpPriority, RiskLevel } from '@/types/api';
import { ErrorState } from './ui';

const DEFAULT_DAYS: Record<RiskLevel, number> = { HIGH: 3, MODERATE: 7, LOW: 15 };
const DEFAULT_PRIORITY: Record<RiskLevel, FollowUpPriority> = { HIGH: 'HIGH', MODERATE: 'NORMAL', LOW: 'LOW' };

/** Creates a follow-up visit, pre-filled from the risk level (High 3 days, Moderate 7, Low 15). */
export function FollowUpForm({
  patientId,
  screeningId,
  risk = 'LOW',
  onDone,
}: {
  patientId: number;
  screeningId?: number | null;
  risk?: RiskLevel;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  // The ASHA dashboard only counts follow-ups assigned to that ASHA, so every
  // follow-up is assigned to the ASHA who registered the patient.
  const patient = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.patient(patientId) });
  const [date, setDate] = useState(dateInputValue(DEFAULT_DAYS[risk]));
  const [priority, setPriority] = useState<FollowUpPriority>(DEFAULT_PRIORITY[risk]);
  const [notes, setNotes] = useState('');

  const m = useMutation({
    mutationFn: () =>
      api.createFollowup({
        patient_id: patientId,
        screening_id: screeningId ?? undefined,
        assigned_to_user_id: patient.data?.registered_by,
        scheduled_date: toBackendDate(date),
        priority,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['patient-record', patientId] });
      onDone?.();
    },
  });

  if (m.isSuccess) {
    return <p className="rounded-lg bg-risk-lowbg px-4 py-3 text-risk-low">Follow-up saved for {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fu-date" className="label">Visit date</label>
          <input id="fu-date" type="date" className="input" min={dateInputValue(0)} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="fu-priority" className="label">Priority</label>
          <select id="fu-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as FollowUpPriority)}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="fu-notes" className="label">Notes (optional)</label>
        <textarea id="fu-notes" rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What to check on the next visit" />
      </div>
      {m.error && <ErrorState message={(m.error as Error).message} />}
      <button type="submit" className="btn btn-primary" disabled={m.isPending || !date || !patient.data}>
        {m.isPending ? 'Saving' : 'Schedule follow-up'}
      </button>
    </form>
  );
}
