'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Patient } from '@/types/api';

/** Loads the patient list and a lookup map by id (dashboards only return patient_id). */
export function usePatients() {
  const query = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const byId = useMemo(() => {
    const map = new Map<number, Patient>();
    (query.data || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [query.data]);
  return { ...query, patients: query.data || [], byId };
}
