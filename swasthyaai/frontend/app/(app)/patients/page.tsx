'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePatients } from '@/hooks/usePatients';
import { initials } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { IconChevron, IconSearch, IconUserPlus } from '@/components/Icons';

export default function PatientsPage() {
  const { user } = useAuth();
  const { patients, isLoading, error, refetch } = usePatients();
  const [search, setSearch] = useState('');
  // The backend returns only the patients this user may see:
  // ASHA her own, ANM those of her ASHA workers.
  const isAnm = user?.role === 'ANM';
  const ashas = useQuery({ queryKey: ['my-ashas'], queryFn: api.myAshas, enabled: isAnm });
  const ashaName = useMemo(() => new Map((ashas.data || []).map((a) => [a.id, a.name])), [ashas.data]);
  const [worker, setWorker] = useState('');

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter(
      (p) =>
        (!worker || String(p.registered_by) === worker) &&
        (!q || [p.name, p.patient_code, p.village, p.contact || '', p.guardian_name || ''].some((v) => v.toLowerCase().includes(q)))
    );
  }, [patients, search, worker]);

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Search by name, patient code, village, phone or guardian."
        action={
          user?.role === 'ASHA' && (
            <Link href="/patients/new" className="btn btn-primary">
              <IconUserPlus size={18} /> Add new person
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Search patients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search patients"
          />
        </div>
        {isAnm && (ashas.data?.length || 0) > 0 && (
          <select
            className="input sm:w-56"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            aria-label="Filter by ASHA worker"
          >
            <option value="">All my ASHA workers</option>
            {ashas.data!.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}

      {isLoading ? (
        <Spinner label="Loading patients" />
      ) : list.length === 0 ? (
        <EmptyState>
          {search
            ? `No patients match “${search}”.`
            : isAnm && ashas.data && ashas.data.length === 0
              ? 'No ASHA workers are assigned to you yet. Ask the Admin to add them under your name.'
              : 'No patients registered yet.'}
          {user?.role === 'ASHA' && (
            <div className="mt-3">
              <Link href="/patients/new" className="btn btn-secondary">Add new person</Link>
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            {list.length} patient{list.length === 1 ? '' : 's'}
          </p>
          <ul className="panel divide-y divide-line">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/patients/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-neem-50">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neem-100 font-semibold text-neem-800">
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {p.patient_code}, {p.age} y, {p.gender}, {p.village}
                    </span>
                    {isAnm && (
                      <span className="block truncate text-sm text-muted">
                        ASHA: {p.registered_by === user?.id ? 'you' : ashaName.get(p.registered_by) || '…'}
                      </span>
                    )}
                  </span>
                  <IconChevron size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
