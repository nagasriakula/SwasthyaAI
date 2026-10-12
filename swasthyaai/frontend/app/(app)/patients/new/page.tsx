'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { generatePatientCode } from '@/lib/format';
import { RoleGuard } from '@/components/RoleGuard';
import { PageHeader } from '@/components/ui';
import { PatientForm, type PatientFormValues } from '@/components/PatientForm';

function NewPatient() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [serverError, setServerError] = useState('');

  async function submit(values: PatientFormValues) {
    setServerError('');
    // patient_code must be unique; retry with a new code if it collides.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const patient = await api.createPatient({ ...values, patient_code: generatePatientCode() });
        await qc.invalidateQueries({ queryKey: ['patients'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        router.push(`/screening/capture?patient=${patient.id}&new=1`);
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 400 && /code already exists/i.test(e.message)) continue;
        setServerError(e instanceof Error ? e.message : 'Could not save the patient.');
        return;
      }
    }
    setServerError('Could not create a unique patient code. Try again.');
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add new person" subtitle="A patient code is created automatically. After saving, you go straight to screening." back="/patients" />
      <PatientForm
        defaults={{ village: user?.village || '' }}
        submitLabel="Save and start screening"
        submittingLabel="Saving"
        serverError={serverError}
        consentRequired
        onSubmit={submit}
        onCancel={() => router.back()}
      />
    </div>
  );
}

export default function NewPatientPage() {
  return (
    <RoleGuard roles={['ASHA']}>
      <NewPatient />
    </RoleGuard>
  );
}
