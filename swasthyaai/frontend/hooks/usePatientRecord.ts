'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Full record for one patient: profile, QR token, screening history and follow-ups.
 *
 * The backend has no "screenings of a patient" endpoint, so history comes from the
 * health-card lookup: POST /api/healthcard/{id} (returns the existing card if one
 * exists) gives the token, then GET /api/health-card/{token} returns the history.
 */
export function usePatientRecord(patientId: number) {
  const patient = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.patient(patientId),
    enabled: Number.isFinite(patientId),
  });

  const record = useQuery({
    queryKey: ['patient-record', patientId],
    queryFn: async () => {
      const { health_card } = await api.createHealthCard(patientId);
      const data = await api.healthCard(health_card.token);
      return { token: health_card.token, ...data };
    },
    enabled: patient.isSuccess,
  });

  return { patient, record };
}
