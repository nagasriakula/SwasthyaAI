'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dateInputValue, formatDate, toBackendDate } from '@/lib/format';
import type { FollowUp, FollowUpPriority } from '@/types/api';
import { ErrorState } from './ui';

/**
 * ANM review decision (PRD §19 "Review Action").
 *
 * The backend has no review endpoint yet, so the decision is recorded on the
 * follow-up linked to this screening: an open one is updated, otherwise a new
 * one is created. Notes start with "ANM REVIEW" so the decision is visible
 * in history and on the ASHA side.
 */
export const REVIEW_PREFIX = 'ANM REVIEW';

const DECISIONS: { key: string; label: string; text: string; priority: FollowUpPriority; days: number; cls: string }[] = [
  { key: 'refer', label: 'Refer to PHC / doctor', text: 'Referred to PHC', priority: 'URGENT', days: 1, cls: 'btn-primary' },
  { key: 'recheck', label: 'Request recheck', text: 'Recheck requested', priority: 'HIGH', days: 3, cls: 'btn-secondary' },
  { key: 'routine', label: 'Reviewed, routine monitoring', text: 'Reviewed, routine monitoring', priority: 'LOW', days: 15, cls: 'btn-ghost' },
];

export function reviewOf(followups: Pick<FollowUp, 'notes' | 'scheduled_date' | 'screening_id'>[], screeningId: number) {
  return followups.find((f) => f.screening_id === screeningId && f.notes?.startsWith(REVIEW_PREFIX)) || null;
}

export function ReviewPanel({ screeningId, patientId }: { screeningId: number; patientId: number }) {
  const qc = useQueryClient();
  const patient = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.patient(patientId) });
  const followups = useQuery({ queryKey: ['followups', 'all'], queryFn: () => api.followups() });
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);

  const linked = (followups.data?.followups || []).filter((f) => f.screening_id === screeningId);
  const existingReview = reviewOf(linked, screeningId);
  const openLinked = linked.find((f) => f.status !== 'COMPLETED' && f.status !== 'CANCELLED');

  const m = useMutation({
    mutationFn: async (key: string) => {
      const d = DECISIONS.find((x) => x.key === key)!;
      const scheduled = toBackendDate(date || dateInputValue(d.days));
      const assignee = patient.data?.registered_by;
      const notes = `${REVIEW_PREFIX}: ${d.text}.${note.trim() ? ` ${note.trim()}` : ''}`;
      if (openLinked) {
        return api.updateFollowup(openLinked.id, { priority: d.priority, scheduled_date: scheduled, notes, assigned_to_user_id: assignee });
      }
      return api.createFollowup({
        patient_id: patientId,
        screening_id: screeningId,
        priority: d.priority,
        scheduled_date: scheduled,
        notes,
        assigned_to_user_id: assignee,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['patient-record', patientId] });
      setNote('');
    },
  });

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">ANM review</h2>
      {existingReview ? (
        <p className="mt-1 rounded-lg bg-risk-lowbg px-3 py-2 text-risk-low">
          {existingReview.notes?.replace(/\.?\s*$/, '.')} Next visit {formatDate(existingReview.scheduled_date)}.
        </p>
      ) : (
        <p className="mt-1 text-muted">Not reviewed yet. Your decision is saved as this patient’s follow-up.</p>
      )}

      <label htmlFor="rv-note" className="label mt-4">Review notes for the ASHA worker</label>
      <textarea
        id="rv-note"
        rows={2}
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="For example: take her to the PHC on Monday for a haemoglobin test"
      />
      <div className="mt-3 max-w-xs">
        <label htmlFor="rv-date" className="label">Next visit (optional)</label>
        <input id="rv-date" type="date" className="input" min={dateInputValue(0)} value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="mt-1 text-sm text-muted">If empty: referral 1 day, recheck 3 days, routine 15 days.</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d.key}
            className={`btn ${d.cls}`}
            disabled={m.isPending || followups.isLoading || !patient.data}
            onClick={() => {
              setChosen(d.key);
              m.mutate(d.key);
            }}
          >
            {m.isPending && chosen === d.key ? 'Saving' : d.label}
          </button>
        ))}
      </div>
      {m.isSuccess && <p className="mt-3 text-risk-low">Decision saved. The ASHA worker will see it in her follow-ups.</p>}
      {m.error && (
        <div className="mt-3">
          <ErrorState message={(m.error as Error).message} />
        </div>
      )}
    </section>
  );
}
