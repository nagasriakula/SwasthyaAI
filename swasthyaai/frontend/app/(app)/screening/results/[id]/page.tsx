'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SCREENING_LABEL } from '@/lib/format';
import { ResultView } from '@/components/ResultView';
import { FollowUpForm } from '@/components/FollowUpForm';
import { ReviewPanel } from '@/components/ReviewPanel';
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';

function ResultContent() {
  const id = Number(useParams<{ id: string }>().id);
  const fresh = !!useSearchParams().get('fresh');
  const { user } = useAuth();

  const screening = useQuery({ queryKey: ['screening', id], queryFn: () => api.screening(id) });
  const result = useQuery({ queryKey: ['screening-result', id], queryFn: () => api.screeningResult(id), enabled: screening.isSuccess });
  const patientId = screening.data?.patient_id;
  const patient = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.patient(patientId!), enabled: !!patientId });

  if (screening.isLoading || result.isLoading) return <Spinner label="Loading result" />;
  if (screening.error) return <ErrorState message={(screening.error as Error).message} onRetry={() => screening.refetch()} />;
  const s = screening.data!;
  const p = patient.data;
  const back = p ? `/patients/${p.id}` : user?.role === 'ANM' ? '/dashboard/anm' : '/dashboard/asha';
  const title = p ? `${p.name}: ${SCREENING_LABEL[s.screening_type]}` : `${SCREENING_LABEL[s.screening_type]} screening`;

  if (result.error) {
    const notReady = result.error instanceof ApiError && result.error.status === 404;
    return (
      <div className="max-w-2xl">
        <PageHeader title={title} back={back} />
        {notReady ? (
          <EmptyState>
            This screening has no result yet
            {s.status === 'QUALITY_FAILED' ? ' because the photo failed the quality check' : ''}.
            {user?.role === 'ASHA' && (
              <div className="mt-3">
                <Link href={`/screening/capture?patient=${s.patient_id}&type=${s.screening_type}`} className="btn btn-secondary">
                  Screen again
                </Link>
              </div>
            )}
          </EmptyState>
        ) : (
          <ErrorState message={(result.error as Error).message} onRetry={() => result.refetch()} />
        )}
      </div>
    );
  }
  const r = result.data!;

  return (
    <div>
      <PageHeader title={title} subtitle={p ? `${p.patient_code}, ${p.age} y, ${p.village}` : undefined} back={back} />

      {fresh && (
        <div className="mb-5 rounded-lg bg-risk-lowbg px-4 py-3 text-risk-low">
          Photo passed the quality check and the result has been saved.
          {r.risk_level === 'HIGH' && ' This case now appears in the ANM priority queue.'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ResultView
          r={{
            screeningType: s.screening_type,
            date: r.created_at || s.screening_date,
            prediction: r.prediction,
            confidence: r.confidence,
            riskLevel: r.risk_level,
            riskReason: r.risk_reason || r.explanation,
            modelVersion: r.model_version,
            riskEngineVersion: r.risk_engine_version,
            gradcamPath: r.gradcam_path,
            imagePath: s.image_reference,
            symptoms: s.symptoms,
          }}
        />

        <div className="space-y-5">
          {user?.role === 'ANM' && <ReviewPanel screeningId={s.id} patientId={s.patient_id} />}

          {user?.role === 'ASHA' && (
            <section className="panel p-5">
              <h2 className="mb-1 text-lg font-semibold">Schedule follow-up</h2>
              <p className="mb-4 text-sm text-muted">Pre-filled from the risk level. Change the date if needed.</p>
              <FollowUpForm patientId={s.patient_id} screeningId={s.id} risk={r.risk_level} />
            </section>
          )}

          <div className="flex flex-col gap-2">
            {p && (
              <Link href={`/patients/${p.id}`} className="btn btn-secondary">
                Patient record and QR card
              </Link>
            )}
            {user?.role === 'ASHA' && (
              <Link href={`/screening/capture?patient=${s.patient_id}`} className="btn btn-ghost">
                Screen for another condition
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResultContent />
    </Suspense>
  );
}
