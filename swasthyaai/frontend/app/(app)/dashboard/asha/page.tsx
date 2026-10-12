'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePatients } from '@/hooks/usePatients';
import { formatDate, initials, whenText } from '@/lib/format';
import { RoleGuard } from '@/components/RoleGuard';
import { EmptyState, ErrorState, Section, Spinner } from '@/components/ui';
import { ConditionSummary, FollowUpList, RiskSummary, ScreeningRow, StatStrip } from '@/components/DashboardParts';
import { IconCalendar, IconCamera, IconChevron, IconQr, IconUserPlus } from '@/components/Icons';

function AshaDashboardContent() {
  const { user } = useAuth();
  const dash = useQuery({ queryKey: ['dashboard', 'asha'], queryFn: api.ashaDashboard });
  const { patients, byId, isLoading: patientsLoading } = usePatients();

  if (dash.isLoading || patientsLoading) return <Spinner label="Loading your dashboard" />;
  if (dash.error) return <ErrorState message={(dash.error as Error).message} onRetry={() => dash.refetch()} />;
  const d = dash.data!;

  const myPatients = patients.filter((p) => p.registered_by === user?.id);
  const dueCount = d.followups.due + d.followups.overdue;
  const openFollowUps = d.recent_followups
    .filter((f) => f.status === 'OVERDUE' || f.status === 'DUE' || f.status === 'PENDING')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
  const next = openFollowUps.find((f) => f.status === 'PENDING' || f.status === 'DUE');
  const nextPatient = next ? byId.get(next.patient_id) : undefined;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Namaste, {d.user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-muted">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {dueCount > 0 && (
              <>
                {' · '}
                <Link href="/reminders" className="font-medium text-risk-high hover:underline">
                  {dueCount} follow-up{dueCount === 1 ? '' : 's'} need a visit
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Link href="/patients/new" className="flex items-center gap-4 rounded-xl bg-neem-700 p-5 text-white hover:bg-neem-800">
          <IconUserPlus size={30} className="shrink-0 text-turmeric-300" />
          <span className="flex-1">
            <span className="block text-lg font-semibold">Add new person</span>
            <span className="block text-sm text-neem-100">Register and start screening</span>
          </span>
          <IconChevron />
        </Link>
        <Link href="/screening/capture" className="flex items-center gap-3 rounded-xl bg-white p-5 ring-1 ring-line hover:ring-2 hover:ring-neem-500">
          <IconCamera size={26} className="shrink-0 text-neem-700" />
          <span className="text-lg font-semibold">Start screening</span>
        </Link>
        <Link href="/qr-scan" className="flex items-center gap-3 rounded-xl bg-white p-5 ring-1 ring-line hover:ring-2 hover:ring-neem-500">
          <IconQr size={26} className="shrink-0 text-neem-700" />
          <span className="text-lg font-semibold">Scan QR card</span>
        </Link>
      </div>

      <div className="mt-6">
        <StatStrip
          items={[
            { label: 'My patients', value: myPatients.length, href: '/patients' },
            { label: 'Screenings done', value: d.screenings.analyzed },
            { label: 'High-risk results', value: d.risk.high, tone: d.risk.high ? 'text-risk-high' : undefined },
            { label: 'Follow-ups due', value: dueCount, tone: dueCount ? 'text-risk-moderate' : undefined, href: '/reminders' },
          ]}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-8">
          <Section
            title="Recent patients"
            action={
              <Link href="/patients" className="text-sm font-medium text-neem-700 hover:underline">
                View all
              </Link>
            }
          >
            {myPatients.length === 0 ? (
              <EmptyState>
                No patients registered yet.
                <div className="mt-3">
                  <Link href="/patients/new" className="btn btn-secondary">Add new person</Link>
                </div>
              </EmptyState>
            ) : (
              <ul className="panel divide-y divide-line">
                {myPatients.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neem-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neem-100 font-semibold text-neem-800">
                        {initials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-sm text-muted">
                          {p.patient_code}, {p.age} y, {p.gender}, {p.village}
                        </span>
                      </span>
                      <IconChevron size={18} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent screenings">
            {d.recent_screenings.length === 0 ? (
              <EmptyState>No screenings yet. Start one from a patient’s profile.</EmptyState>
            ) : (
              <ul className="panel divide-y divide-line">
                {d.recent_screenings.slice(0, 6).map((s) => (
                  <ScreeningRow key={s.id} s={s} patient={byId.get(s.patient_id)} />
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-8">
          <Section title="Next screening">
            {next ? (
              <Link href={`/patients/${next.patient_id}`} className="panel flex items-center gap-4 p-5 hover:ring-2 hover:ring-neem-500">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-turmeric-100 text-ink">
                  <IconCalendar size={24} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{nextPatient ? nextPatient.name : `Patient #${next.patient_id}`}</span>
                  <span className="block text-sm text-muted">
                    {formatDate(next.scheduled_date)} ({whenText(next.scheduled_date)})
                  </span>
                </span>
              </Link>
            ) : (
              <EmptyState>No upcoming screening visits.</EmptyState>
            )}
          </Section>

          <Section title="Follow-up reminders">
            <FollowUpList items={openFollowUps.slice(0, 5)} byId={byId} empty="No follow-ups pending." />
          </Section>

          <Section title="Risk summary">
            <RiskSummary risk={d.risk} />
          </Section>

          <Section title="Screenings by condition">
            <ConditionSummary s={d.screenings} />
          </Section>
        </div>
      </div>
    </div>
  );
}

export default function AshaDashboardPage() {
  return (
    <RoleGuard roles={['ASHA']}>
      <AshaDashboardContent />
    </RoleGuard>
  );
}
