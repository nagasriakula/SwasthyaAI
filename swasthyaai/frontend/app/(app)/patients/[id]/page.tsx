'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { usePatientRecord } from '@/hooks/usePatientRecord';
import { RISK_LABEL, RISK_ORDER, SCREENING_LABEL, formatDate, formatPercent, predictionLabel, splitList, whenText } from '@/lib/format';
import type { HealthCardRecord, RiskLevel, ScreeningType } from '@/types/api';
import { HealthCard, qrValue } from '@/components/HealthCard';
import { FollowUpForm } from '@/components/FollowUpForm';
import { REVIEW_PREFIX } from '@/components/ReviewPanel';
import { EmptyState, ErrorState, FollowUpStatusText, PageHeader, RiskBadge, Section, Spinner } from '@/components/ui';
import { IconCamera, IconChevron } from '@/components/Icons';

/** Copies the same link that is inside the QR code, for testing or sharing without a camera. */
function CopyCardLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const link = qrValue(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this card link:', link);
    }
  }
  return (
    <button onClick={copy} className="btn btn-ghost btn-sm">
      {copied ? 'Link copied' : 'Copy card link'}
    </button>
  );
}

type HistoryItem = HealthCardRecord['screenings'][number];

/** Latest vs previous analysed screening of each type (PRD §17.2). */
function Progress({ screenings }: { screenings: HistoryItem[] }) {
  const rows = (['ANEMIA', 'JAUNDICE', 'SKIN'] as ScreeningType[])
    .map((type) => {
      const done = screenings
        .filter((s) => s.screening_type === type && s.status === 'ANALYZED' && s.risk_level)
        .sort((a, b) => new Date(b.screening_date).getTime() - new Date(a.screening_date).getTime());
      return { type, latest: done[0], previous: done[1] };
    })
    .filter((r) => r.latest && r.previous);

  if (rows.length === 0) return null;

  return (
    <Section title="Progress since last screening">
      <ul className="panel divide-y divide-line">
        {rows.map(({ type, latest, previous }) => {
          const a = RISK_ORDER[previous!.risk_level as RiskLevel];
          const b = RISK_ORDER[latest!.risk_level as RiskLevel];
          const trend = b > a ? 'Improved' : b < a ? 'Worse' : 'No change';
          const tone = b > a ? 'text-risk-low' : b < a ? 'text-risk-high' : 'text-muted';
          return (
            <li key={type} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="w-24 font-medium">{SCREENING_LABEL[type]}</span>
              <span className="text-muted">
                {RISK_LABEL[previous!.risk_level as RiskLevel]} ({formatDate(previous!.screening_date)}) →{' '}
                <span className="text-ink">{RISK_LABEL[latest!.risk_level as RiskLevel]}</span> ({formatDate(latest!.screening_date)})
              </span>
              <span className={`ml-auto font-semibold ${tone}`}>{trend}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export default function PatientProfilePage() {
  const id = Number(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const { patient, record } = usePatientRecord(id);
  const [showFollowUp, setShowFollowUp] = useState(false);

  if (patient.isLoading) return <Spinner label="Loading patient" />;
  if (patient.error) return <ErrorState message={(patient.error as Error).message} onRetry={() => patient.refetch()} />;
  const p = patient.data!;
  const r = record.data;
  const isAsha = user?.role === 'ASHA';

  const details = [
    { label: 'Age', value: `${p.age} years` },
    { label: 'Gender', value: p.gender },
    { label: 'Village', value: p.village },
    { label: 'Mobile', value: p.contact || 'Not given' },
    { label: 'Guardian', value: p.guardian_name || 'Not given' },
  ];

  return (
    <div>
      <PageHeader
        title={p.name}
        subtitle={`${p.patient_code}, ${p.village}`}
        back="/patients"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/patients/${id}/edit`} className="btn btn-secondary">Edit details</Link>
            {isAsha && (
              <Link href={`/screening/capture?patient=${id}`} className="btn btn-primary">
                <IconCamera size={18} /> Start screening
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          {r ? (
            <div>
              <HealthCard patient={p} token={r.token} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => window.print()} className="btn btn-secondary btn-sm">Print health card</button>
                <CopyCardLink token={r.token} />
              </div>
            </div>
          ) : record.error ? (
            <ErrorState message={`Health card: ${(record.error as Error).message}`} onRetry={() => record.refetch()} />
          ) : (
            <div className="panel h-36 animate-pulse" />
          )}

          <dl className="panel divide-y divide-line">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-muted">{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>

          {(p.symptoms || p.medical_history) && (
            <div className="panel space-y-3 p-4">
              {p.symptoms && (
                <div>
                  <div className="text-sm text-muted">Symptoms at registration</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {splitList(p.symptoms).map((s) => (
                      <span key={s} className="rounded-full bg-neem-50 px-3 py-1 text-sm">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.medical_history && (
                <div>
                  <div className="text-sm text-muted">Medical history</div>
                  <p className="mt-1">{p.medical_history}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-8">
          {record.isLoading && <Spinner label="Loading history" />}

          {r && <Progress screenings={r.screenings} />}

          {r && (
            <Section title="Screening history">
              {r.screenings.length === 0 ? (
                <EmptyState>
                  No screenings yet.
                  {isAsha && (
                    <div className="mt-3">
                      <Link href={`/screening/capture?patient=${id}`} className="btn btn-secondary">Start first screening</Link>
                    </div>
                  )}
                </EmptyState>
              ) : (
                <ul className="panel divide-y divide-line">
                  {r.screenings.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.status === 'ANALYZED' ? `/screening/results/${s.id}` : `/screening/capture?patient=${id}&type=${s.screening_type}`}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-neem-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {SCREENING_LABEL[s.screening_type]}
                            {s.prediction ? `: ${predictionLabel(s.prediction, s.screening_type)}` : ''}
                          </span>
                          <span className="block text-sm text-muted">
                            {formatDate(s.screening_date)}
                            {s.confidence !== null ? `, ${formatPercent(s.confidence)} confidence` : ''}
                            {s.status === 'QUALITY_FAILED' ? ', photo failed the quality check' : ''}
                            {s.status === 'PENDING' ? ', not analysed' : ''}
                          </span>
                        </span>
                        <RiskBadge level={s.risk_level} />
                        <IconChevron size={18} className="text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {r && (
            <Section
              title="Follow-ups"
              action={
                !showFollowUp && (
                  <button onClick={() => setShowFollowUp(true)} className="btn btn-secondary btn-sm">Schedule follow-up</button>
                )
              }
            >
              {showFollowUp && (
                <div className="panel mb-4 p-5">
                  <FollowUpForm patientId={id} onDone={() => setTimeout(() => setShowFollowUp(false), 1500)} />
                </div>
              )}
              {r.followups.length === 0 ? (
                <EmptyState>No follow-ups for this patient.</EmptyState>
              ) : (
                <ul className="panel divide-y divide-line">
                  {r.followups.map((f) => (
                    <li key={f.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {formatDate(f.scheduled_date)}
                          {f.status === 'PENDING' && <span className="ml-2 text-sm font-normal text-muted">({whenText(f.scheduled_date)})</span>}
                        </span>
                        <FollowUpStatusText status={f.status} />
                      </div>
                      {f.notes && (
                        <p className={`mt-1 text-[15px] ${f.notes.startsWith(REVIEW_PREFIX) ? 'rounded-md bg-turmeric-100 px-2 py-1' : 'text-muted'}`}>{f.notes}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted">Priority: {String(f.priority).toLowerCase()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
