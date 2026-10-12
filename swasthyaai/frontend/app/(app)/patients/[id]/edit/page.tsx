'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ErrorState, PageHeader, Spinner } from '@/components/ui';
import { PatientForm, type PatientFormValues } from '@/components/PatientForm';

export default function EditPatientPage() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const patient = useQuery({ queryKey: ['patient', id], queryFn: () => api.patient(id) });

  async function submit(values: PatientFormValues) {
    setServerError('');
    try {
      await api.updatePatient(id, values);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['patient', id] }),
        qc.invalidateQueries({ queryKey: ['patients'] }),
        qc.invalidateQueries({ queryKey: ['patient-record', id] }),
      ]);
      router.push(`/patients/${id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not save changes.');
    }
  }

  if (patient.isLoading) return <Spinner label="Loading patient" />;
  if (patient.error) return <ErrorState message={(patient.error as Error).message} onRetry={() => patient.refetch()} />;
  const p = patient.data!;

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Edit ${p.name}`} subtitle={`Patient code ${p.patient_code} cannot be changed.`} back={`/patients/${id}`} />
      <PatientForm defaults={p} submitLabel="Save changes" submittingLabel="Saving" serverError={serverError} onSubmit={submit} onCancel={() => router.back()} />
    </div>
  );
}
