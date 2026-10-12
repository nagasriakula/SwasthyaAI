'use client';

import Link from 'next/link';
import { Suspense, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { SCREENING_OPTIONS, SYMPTOM_OPTIONS, initials } from '@/lib/format';
import type { QualityFailure, ScreeningType } from '@/types/api';
import { usePatients } from '@/hooks/usePatients';
import { RoleGuard } from '@/components/RoleGuard';
import { CameraCapture, type CapturedImage } from '@/components/CameraCapture';
import { ErrorState, PageHeader, Spinner } from '@/components/ui';
import { IconAlert, IconCheck, IconSearch } from '@/components/Icons';

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold ${done ? 'bg-neem-700 text-white' : 'bg-turmeric-100 text-ink'}`}>
          {done ? <IconCheck size={18} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const QUALITY_TEXT: Record<string, string> = {
  IMAGE_TOO_DARK: 'The photo is too dark.',
  IMAGE_TOO_BRIGHT: 'The photo is too bright.',
  IMAGE_TOO_BLURRY: 'The photo is blurry.',
  RESOLUTION_TOO_LOW: 'The photo resolution is too low.',
  INVALID_IMAGE: 'The file is not a valid image.',
};

function PatientPicker({ onPick }: { onPick: (id: number) => void }) {
  const { patients, isLoading } = usePatients();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return patients.filter((p) => !s || [p.name, p.patient_code, p.village].some((v) => v.toLowerCase().includes(s))).slice(0, 8);
  }, [patients, q]);

  if (isLoading) return <Spinner label="Loading patients" />;
  return (
    <div>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-10" placeholder="Search by name, code or village" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search patient" />
      </div>
      <ul className="mt-3 divide-y divide-line rounded-lg ring-1 ring-line">
        {list.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neem-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neem-100 text-sm font-semibold text-neem-800">{initials(p.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-sm text-muted">{p.patient_code}, {p.village}</span>
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-3 text-muted">No patients found.</li>}
      </ul>
      <Link href="/patients/new" className="btn btn-ghost mt-3">Register a new person instead</Link>
    </div>
  );
}

function CaptureContent() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const [patientId, setPatientId] = useState<number | null>(params.get('patient') ? Number(params.get('patient')) : null);
  const initialType = params.get('type') as ScreeningType | null;
  const [type, setType] = useState<ScreeningType | null>(SCREENING_OPTIONS.some((o) => o.type === initialType) ? initialType : null);
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [otherSymptoms, setOtherSymptoms] = useState('');

  // Reused when a photo fails the quality check, so a recapture does not create a new screening.
  const [screeningId, setScreeningId] = useState<number | null>(null);
  const [screeningFor, setScreeningFor] = useState<string>('');
  const screeningRef = useRef<number | null>(null);
  const [busy, setBusy] = useState<'' | 'creating' | 'analysing'>('');
  const [quality, setQuality] = useState<QualityFailure | null>(null);
  const [error, setError] = useState('');

  const patient = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.patient(patientId!),
    enabled: patientId !== null,
  });

  const option = SCREENING_OPTIONS.find((o) => o.type === type);
  const symptomText = [...symptoms, ...otherSymptoms.split(',').map((s) => s.trim()).filter(Boolean)].join(', ');

  async function analyse() {
    if (!patientId || !type || !image) return;
    setError('');
    setQuality(null);
    try {
      let id = screeningId;
      const key = `${patientId}-${type}`;
      if (!id || screeningFor !== key) {
        setBusy('creating');
        const created = await api.createScreening(patientId, type, symptomText || undefined);
        id = created.screening.id;
        setScreeningId(id);
        setScreeningFor(key);
      }
      screeningRef.current = id;
      setBusy('analysing');
      await api.analyzeScreening(id, image.blob, image.filename, symptomText || undefined);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['patient-record', patientId] });
      router.push(`/screening/results/${id}?fresh=1`);
    } catch (e) {
      // A long analysis can outlast the connection even though the backend
      // finished and saved the result. If a result exists, show it.
      if (screeningRef.current && !(e instanceof ApiError && e.status >= 400 && e.status < 500)) {
        try {
          await api.screeningResult(screeningRef.current);
          qc.invalidateQueries({ queryKey: ['dashboard'] });
          qc.invalidateQueries({ queryKey: ['patient-record', patientId] });
          router.push(`/screening/results/${screeningRef.current}?fresh=1`);
          return;
        } catch {
          /* no result saved: fall through to the error message */
        }
      }
      if (e instanceof ApiError && e.status === 422 && e.detail && typeof e.detail === 'object' && 'reason_code' in e.detail) {
        setQuality(e.detail as QualityFailure);
      } else if (e instanceof ApiError && e.status === 501) {
        setError(`${e.message} The anaemia model is not connected in the backend yet. Try Jaundice or Skin screening.`);
      } else {
        setError(e instanceof Error ? e.message : 'Screening failed. Try again.');
      }
    } finally {
      setBusy('');
    }
  }

  // ---------- Step 0: no patient chosen ----------
  if (!patientId) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Start screening" subtitle="Choose the person to screen." />
        <div className="panel p-5">
          <PatientPicker onPick={setPatientId} />
        </div>
      </div>
    );
  }

  if (patient.isLoading) return <Spinner label="Loading patient" />;
  if (patient.error) return <ErrorState message={(patient.error as Error).message} onRetry={() => patient.refetch()} />;
  const p = patient.data!;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Screening: ${p.name}`}
        subtitle={`${p.patient_code}, ${p.age} y, ${p.gender}, ${p.village}`}
        back={`/patients/${p.id}`}
      />

      {params.get('new') && (
        <div className="mb-4 rounded-lg bg-risk-lowbg px-4 py-3 text-risk-low">
          {p.name} is registered with code <strong>{p.patient_code}</strong>. Now choose what to screen for.
        </div>
      )}

      <div className="space-y-4">
        <Step n={1} title="What are you screening for?" done={!!type}>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Screening type">
            {SCREENING_OPTIONS.map((o) => (
              <button
                key={o.type}
                role="radio"
                aria-checked={type === o.type}
                onClick={() => {
                  if (option?.bodyArea !== o.bodyArea) setImage(null);
                  setType(o.type);
                  setQuality(null);
                  setError('');
                }}
                className={`rounded-xl p-4 text-left ring-inset transition-colors ${
                  type === o.type ? 'bg-neem-700 text-white ring-2 ring-neem-700' : 'bg-white ring-1 ring-line hover:ring-neem-500'
                }`}
              >
                <span className="block text-lg font-semibold">{o.title}</span>
                <span className={`block text-sm ${type === o.type ? 'text-neem-100' : 'text-muted'}`}>Photo: {o.photo}</span>
              </button>
            ))}
          </div>
        </Step>

        {option && (
          <Step n={2} title={`Take the photo: ${option.photo.toLowerCase()}`} done={!!image && !quality}>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-[15px]">
              {option.guidance.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>

            {quality && (
              <div className="mb-4 rounded-lg bg-risk-moderatebg px-4 py-3 text-risk-moderate" role="alert">
                <div className="flex items-start gap-2 font-semibold">
                  <IconAlert size={18} className="mt-0.5 shrink-0" />
                  Photo not accepted. {QUALITY_TEXT[quality.reason_code] || ''}
                </div>
                <p className="mt-1">{quality.recapture_guidance} Take the photo again; the result is not calculated from a poor photo.</p>
              </div>
            )}

            <CameraCapture
              shape={option.bodyArea}
              value={image}
              onChange={(img) => {
                setImage(img);
                setQuality(null);
              }}
            />
          </Step>
        )}

        {option && (
          <Step n={3} title="Symptoms (optional)" done={symptoms.length > 0 || !!otherSymptoms.trim()}>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button
                    type="button"
                    key={s}
                    aria-pressed={on}
                    onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[15px] ring-1 ring-inset ${
                      on ? 'bg-neem-700 text-white ring-neem-700' : 'bg-white ring-line hover:ring-neem-500'
                    }`}
                  >
                    {on && <IconCheck size={16} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <label htmlFor="other" className="label mt-4">Other symptoms</label>
            <input id="other" className="input" placeholder="Separate with commas" value={otherSymptoms} onChange={(e) => setOtherSymptoms(e.target.value)} />
            <p className="mt-2 text-sm text-muted">Symptoms are saved with the screening for the ANM. The current models use only the photo.</p>
          </Step>
        )}

        {error && <ErrorState message={error} />}

        {option && (
          <div className="sticky bottom-20 z-10 flex items-center gap-4 rounded-xl bg-white p-4 shadow-lg ring-1 ring-line md:bottom-4">
            <div className="flex-1 text-sm text-muted">
              {!image ? 'Take a photo to continue.' : quality ? 'Retake the photo, then analyse again.' : `${option.title} screening ready.`}
            </div>
            <button onClick={analyse} disabled={!image || !!busy || !!quality} className="btn btn-accent px-6 py-3 text-base">
              {busy === 'creating' ? 'Creating screening' : busy === 'analysing' ? 'Checking photo and analysing' : 'Analyse'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CapturePage() {
  return (
    <RoleGuard roles={['ASHA']}>
      <Suspense fallback={<Spinner />}>
        <CaptureContent />
      </Suspense>
    </RoleGuard>
  );
}
