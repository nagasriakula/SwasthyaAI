'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePatients } from '@/hooks/usePatients';
import { FOLLOWUP_LABEL, RISK_ORDER } from '@/lib/format';
import type { DashboardScreening, FollowUpStatus, RiskLevel } from '@/types/api';
import { RoleGuard } from '@/components/RoleGuard';
import { EmptyState, ErrorState, Section, Spinner } from '@/components/ui';
import { reviewOf } from '@/components/ReviewPanel';
import { ConditionSummary, FollowUpList, RiskSummary, ScreeningRow, StatStrip } from '@/components/DashboardParts';

type Filter = 'ALL' | RiskLevel;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'HIGH', label: 'High' },
  { key: 'MODERATE', label: 'Moderate' },
  { key: 'ALL', label: 'All results' },
];

function sortByPriority(a: DashboardScreening, b: DashboardScreening) {
  const ra = a.risk_level ? RISK_ORDER[a.risk_level] : 3;
  const rb = b.risk_level ? RISK_ORDER[b.risk_level] : 3;
  if (ra !== rb) return ra - rb;
  return new Date(b.screening_date).getTime() - new Date(a.screening_date).getTime();
}

function AnmDashboardContent() {
  const dash = useQuery({ queryKey: ['dashboard', 'anm'], queryFn: api.anmDashboard });
  const { patients, byId, isLoading: patientsLoading } = usePatients();
  const followups = useQuery({ queryKey: ['followups', 'all'], queryFn: () => api.followups() });
  const ashas = useQuery({ queryKey: ['my-ashas'], queryFn: api.myAshas });
  const [filter, setFilter] = useState<Filter>('HIGH');

  // Per ASHA worker: patients, high-risk patients (recent screenings) and open follow-ups.
  const team = useMemo(() => {
    const highPatients = new Set(
      (dash.data?.recent_screenings || []).filter((s) => s.risk_level === 'HIGH').map((s) => s.patient_id)
    );
    const ownerOf = new Map(patients.map((p) => [p.id, p.registered_by]));
    const open = (followups.data?.followups || []).filter((f) => f.status === 'OVERDUE' || f.status === 'DUE');
    return (ashas.data || []).map((a) => {
      const mine = patients.filter((p) => p.registered_by === a.id);
      return {
        asha: a,
        patients: mine.length,
        high: mine.filter((p) => highPatients.has(p.id)).length,
        due: open.filter((f) => ownerOf.get(f.patient_id) === a.id).length,
      };
    });
  }, [ashas.data, patients, dash.data, followups.data]);

  const queue = useMemo(() => {
    const all = followups.data?.followups || [];
    const analyzed = (dash.data?.recent_screenings || []).filter((s) => s.status === 'ANALYZED' && s.risk_level);
    return analyzed
      .filter((s) => filter === 'ALL' || s.risk_level === filter)
      .map((s) => ({ s, reviewed: !!reviewOf(all, s.id) }))
      // Unreviewed cases first, then by risk and date
      .sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || sortByPriority(a.s, b.s));
  }, [dash.data, followups.data, filter]);

  const villages = useMemo(() => {
    const highByPatient = new Set(
      (dash.data?.recent_screenings || []).filter((s) => s.risk_level === 'HIGH').map((s) => s.patient_id)
    );
    const map = new Map<string, { patients: number; high: number }>();
    patients.forEach((p) => {
      const v = map.get(p.village) || { patients: 0, high: 0 };
      v.patients += 1;
      if (highByPatient.has(p.id)) v.high += 1;
      map.set(p.village, v);
    });
    return [...map.entries()].sort((a, b) => b[1].high - a[1].high || b[1].patients - a[1].patients);
  }, [patients, dash.data]);

  if (dash.isLoading || patientsLoading) return <Spinner label="Loading the dashboard" />;
  if (dash.error) return <ErrorState message={(dash.error as Error).message} onRetry={() => dash.refetch()} />;
  const d = dash.data!;

  const openFollowUps = d.recent_followups
    .filter((f) => f.status === 'OVERDUE' || f.status === 'DUE' || f.status === 'PENDING')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  const followUpRows: { status: FollowUpStatus; value: number }[] = [
    { status: 'OVERDUE', value: d.followups.overdue },
    { status: 'DUE', value: d.followups.due },
    { status: 'PENDING', value: d.followups.pending },
    { status: 'COMPLETED', value: d.followups.completed },
    { status: 'CANCELLED', value: d.followups.cancelled },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Patients needing attention</h1>
        <p className="mt-1 text-muted">
          {d.user.name}, ANM
          {ashas.data ? `, ${ashas.data.length} ASHA worker${ashas.data.length === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      <StatStrip
        items={[
          { label: 'High-risk results', value: d.risk.high, tone: d.risk.high ? 'text-risk-high' : undefined },
          { label: 'Moderate-risk results', value: d.risk.moderate, tone: d.risk.moderate ? 'text-risk-moderate' : undefined },
          { label: 'Follow-ups overdue', value: d.followups.overdue, tone: d.followups.overdue ? 'text-risk-high' : undefined, href: '/reminders' },
          { label: 'Total screenings', value: d.screenings.total },
        ]}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <Section title="Priority queue">
            <div className="mb-3 flex gap-1 border-b border-line" role="tablist" aria-label="Filter by risk">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`-mb-px border-b-2 px-4 py-2 font-medium ${
                    filter === f.key ? 'border-neem-700 text-neem-800' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {queue.length === 0 ? (
              <EmptyState>
                {filter === 'ALL' ? 'No analysed screenings yet.' : `No ${filter.toLowerCase()}-risk results in recent screenings.`}
              </EmptyState>
            ) : (
              <ul className="panel divide-y divide-line">
                {queue.map(({ s, reviewed }) => (
                  <ScreeningRow
                    key={s.id}
                    s={s}
                    patient={byId.get(s.patient_id)}
                    action={
                      <Link href={`/screening/results/${s.id}`} className={`btn btn-sm ${reviewed ? 'btn-ghost' : 'btn-primary'}`}>
                        {reviewed ? 'Reviewed' : 'Review'}
                      </Link>
                    }
                  />
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-muted">Most recent screenings. Cases not yet reviewed come first, then highest risk.</p>
          </Section>

          <Section title="Upcoming and overdue follow-ups">
            <FollowUpList items={openFollowUps.slice(0, 6)} byId={byId} empty="No open follow-ups." />
          </Section>
        </div>

        <div className="space-y-8">
          <Section title="My ASHA workers">
            {ashas.isLoading ? (
              <Spinner label="Loading ASHA workers" />
            ) : ashas.error ? (
              <ErrorState message={(ashas.error as Error).message} onRetry={() => ashas.refetch()} />
            ) : team.length === 0 ? (
              <EmptyState>No ASHA workers are assigned to you yet. Ask the Admin to add them under your name.</EmptyState>
            ) : (
              <ul className="panel divide-y divide-line">
                {team.map(({ asha, patients: n, high, due }) => (
                  <li key={asha.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold ${asha.active ? '' : 'text-muted'}`}>
                        {asha.name}
                        {!asha.active && <span className="ml-2 text-xs font-normal">(deactivated)</span>}
                      </span>
                      {asha.phone && (
                        <a href={`tel:${asha.phone}`} className="text-sm font-medium text-neem-700 hover:underline">{asha.phone}</a>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-muted">
                      {asha.village ? `${asha.village}, ` : ''}
                      {n} patient{n === 1 ? '' : 's'}
                      {high > 0 && <span className="font-medium text-risk-high">, {high} high risk</span>}
                      {due > 0 && <span className="font-medium text-risk-moderate">, {due} follow-up{due === 1 ? '' : 's'} due</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Risk summary">
            <RiskSummary risk={d.risk} />
          </Section>

          <Section title="Follow-up status">
            <dl className="panel divide-y divide-line">
              {followUpRows.map((r) => (
                <div key={r.status} className="flex items-center justify-between px-5 py-2.5">
                  <dt className={r.status === 'OVERDUE' && r.value ? 'font-medium text-risk-high' : 'text-muted'}>{FOLLOWUP_LABEL[r.status]}</dt>
                  <dd className="font-semibold tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="By village">
            {villages.length === 0 ? (
              <EmptyState>No patients registered yet.</EmptyState>
            ) : (
              <table className="panel w-full overflow-hidden text-left">
                <thead className="text-sm text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2.5 font-medium">Village</th>
                    <th className="px-3 py-2.5 text-right font-medium">Patients</th>
                    <th className="px-5 py-2.5 text-right font-medium">High risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {villages.slice(0, 8).map(([name, v]) => (
                    <tr key={name}>
                      <td className="px-5 py-2.5">{name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{v.patients}</td>
                      <td className={`px-5 py-2.5 text-right tabular-nums ${v.high ? 'font-semibold text-risk-high' : 'text-muted'}`}>{v.high}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Screenings by condition">
            <ConditionSummary s={d.screenings} />
          </Section>
        </div>
      </div>
    </div>
  );
}

export default function AnmDashboardPage() {
  return (
    <RoleGuard roles={['ANM']}>
      <AnmDashboardContent />
    </RoleGuard>
  );
}
