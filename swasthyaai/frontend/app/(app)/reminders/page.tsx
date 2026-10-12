'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePatients } from '@/hooks/usePatients';
import { FOLLOWUP_LABEL, dateInputValue, formatDate, toBackendDate, whenText } from '@/lib/format';
import type { FollowUp, FollowUpStatus } from '@/types/api';
import { REVIEW_PREFIX } from '@/components/ReviewPanel';
import { EmptyState, ErrorState, FollowUpStatusText, PageHeader, Spinner } from '@/components/ui';

type Tab = 'OPEN' | FollowUpStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'OVERDUE', label: FOLLOWUP_LABEL.OVERDUE },
  { key: 'DUE', label: FOLLOWUP_LABEL.DUE },
  { key: 'PENDING', label: FOLLOWUP_LABEL.PENDING },
  { key: 'COMPLETED', label: FOLLOWUP_LABEL.COMPLETED },
  { key: 'CANCELLED', label: FOLLOWUP_LABEL.CANCELLED },
];

const OPEN = new Set<FollowUpStatus>(['OVERDUE', 'DUE', 'PENDING']);
const ORDER: Record<string, number> = { OVERDUE: 0, DUE: 1, PENDING: 2, COMPLETED: 3, CANCELLED: 4 };

function Row({ f, name, sub }: { f: FollowUp; name: string; sub: string }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'' | 'complete' | 'reschedule'>('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(dateInputValue(7));
  const open = OPEN.has(f.status);

  const m = useMutation({
    mutationFn: (payload: Parameters<typeof api.updateFollowup>[1]) => api.updateFollowup(f.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['patient-record', f.patient_id] });
      setMode('');
      setNotes('');
    },
  });

  // Keep the existing notes (including any ANM review) and add the new note after them.
  const mergedNotes = (extra: string) => [f.notes, extra.trim()].filter(Boolean).join(' | ') || undefined;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <Link href={`/patients/${f.patient_id}`} className="font-semibold hover:underline">{name}</Link>
          <div className="text-sm text-muted">{sub}</div>
          <div className="mt-1 text-[15px]">
            {formatDate(f.scheduled_date)}
            {f.status === 'PENDING' && <span className="text-muted"> ({whenText(f.scheduled_date)})</span>}
            <span className="text-muted">, {String(f.priority).toLowerCase()} priority</span>
          </div>
          {f.notes && (
            <p className={`mt-1 text-[15px] ${f.notes.startsWith(REVIEW_PREFIX) ? 'rounded-md bg-turmeric-100 px-2 py-1' : 'text-muted'}`}>{f.notes}</p>
          )}
          {f.screening_id && (
            <Link href={`/screening/results/${f.screening_id}`} className="mt-1 inline-block text-sm font-medium text-neem-700 hover:underline">
              View screening result
            </Link>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <FollowUpStatusText status={f.status} />
          {open && !mode && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => setMode('complete')}>Mark done</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setMode('reschedule')}>Reschedule</button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={m.isPending}
                onClick={() => {
                  if (window.confirm('Cancel this follow-up?')) m.mutate({ status: 'CANCELLED' });
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {mode && (
        <form
          className="mt-3 space-y-3 rounded-lg bg-paper p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'complete') m.mutate({ status: 'COMPLETED', notes: mergedNotes(notes) });
            else m.mutate({ scheduled_date: toBackendDate(date), notes: mergedNotes(notes) });
          }}
        >
          {mode === 'reschedule' && (
            <div className="max-w-xs">
              <label htmlFor={`d-${f.id}`} className="label">New date</label>
              <input id={`d-${f.id}`} type="date" className="input" min={dateInputValue(0)} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          )}
          <div>
            <label htmlFor={`n-${f.id}`} className="label">{mode === 'complete' ? 'Visit notes (optional)' : 'Reason (optional)'}</label>
            <textarea id={`n-${f.id}`} rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {m.error && <ErrorState message={(m.error as Error).message} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={m.isPending}>
              {m.isPending ? 'Saving' : mode === 'complete' ? 'Save as completed' : 'Save new date'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('')}>Back</button>
          </div>
        </form>
      )}
    </li>
  );
}

export default function RemindersPage() {
  const [tab, setTab] = useState<Tab>('OPEN');
  const q = useQuery({ queryKey: ['followups', 'all'], queryFn: () => api.followups() });
  const { byId } = usePatients();

  const all = q.data?.followups || [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { OPEN: 0 };
    all.forEach((f) => {
      c[f.status] = (c[f.status] || 0) + 1;
      if (OPEN.has(f.status)) c.OPEN = (c.OPEN || 0) + 1;
    });
    return c;
  }, [all]);

  const list = all
    .filter((f) => (tab === 'OPEN' ? OPEN.has(f.status) : f.status === tab))
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  return (
    <div className="max-w-4xl">
      <PageHeader title="Follow-ups" subtitle="Visits to make, oldest overdue first. Status updates automatically from the date." />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 font-medium ${
              tab === t.key ? 'border-neem-700 text-neem-800' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
            {(counts[t.key] || 0) > 0 && (
              <span className={`rounded-full px-2 text-sm ${t.key === 'OVERDUE' ? 'bg-risk-high text-white' : 'bg-neem-100 text-neem-800'}`}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <Spinner label="Loading follow-ups" />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState>{tab === 'OPEN' ? 'No visits pending. Follow-ups are created from a screening result or a patient record.' : 'Nothing here.'}</EmptyState>
      ) : (
        <ul className="panel divide-y divide-line">
          {list.map((f) => {
            const p = byId.get(f.patient_id);
            return <Row key={f.id} f={f} name={p ? p.name : `Patient #${f.patient_id}`} sub={p ? `${p.patient_code}, ${p.village}` : ''} />;
          })}
        </ul>
      )}
    </div>
  );
}
