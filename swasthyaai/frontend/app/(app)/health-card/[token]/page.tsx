'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SCREENING_LABEL, formatDate, formatPercent, predictionLabel } from '@/lib/format';
import { EmptyState, ErrorState, FollowUpStatusText, PageHeader, RiskBadge, Section, Spinner } from '@/components/ui';
import { IconCamera } from '@/components/Icons';

/** Opened after scanning a QR card. Lives inside the signed-in area, so only ASHA/ANM users reach it. */
export default function HealthCardLookupPage() {
  const token = useParams<{ token: string }>().token;
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['health-card', token], queryFn: () => api.healthCard(token) });

  if (q.isLoading) return <Spinner label="Opening health card" />;
  if (q.error) {
    const invalid = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="max-w-xl">
        <PageHeader title="Health card" back="/qr-scan" />
        <ErrorState message={invalid ? 'This QR code is not valid or the card was removed.' : (q.error as Error).message} />
        <Link href="/qr-scan" className="btn btn-secondary mt-4">Scan again</Link>
      </div>
    );
  }
  const { patient: p, screenings, followups } = q.data!;
  const open = followups.filter((f) => f.status !== 'COMPLETED' && f.status !== 'CANCELLED');

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={p.name}
        subtitle={`${p.patient_code}, ${p.age} y, ${p.gender}, ${p.village}`}
        back="/qr-scan"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/patients/${p.id}`} className="btn btn-secondary">Full record</Link>
            {user?.role === 'ASHA' && (
              <Link href={`/screening/capture?patient=${p.id}`} className="btn btn-primary">
                <IconCamera size={18} /> Screen now
              </Link>
            )}
          </div>
        }
      />

      <div className="space-y-8">
        <Section title="Open follow-ups">
          {open.length === 0 ? (
            <EmptyState>No open follow-ups.</EmptyState>
          ) : (
            <ul className="panel divide-y divide-line">
              {open.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span>
                    {formatDate(f.scheduled_date)}
                    {f.notes && <span className="block text-sm text-muted">{f.notes}</span>}
                  </span>
                  <FollowUpStatusText status={f.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Screening history">
          {screenings.length === 0 ? (
            <EmptyState>No screenings yet.</EmptyState>
          ) : (
            <ul className="panel divide-y divide-line">
              {screenings.map((s) => (
                <li key={s.id}>
                  <Link href={`/screening/results/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neem-50">
                    <span className="flex-1">
                      <span className="block font-medium">
                        {SCREENING_LABEL[s.screening_type]}
                        {s.prediction ? `: ${predictionLabel(s.prediction, s.screening_type)}` : ''}
                      </span>
                      <span className="block text-sm text-muted">
                        {formatDate(s.screening_date)}
                        {s.confidence !== null ? `, ${formatPercent(s.confidence)}` : ''}
                      </span>
                    </span>
                    <RiskBadge level={s.risk_level} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
