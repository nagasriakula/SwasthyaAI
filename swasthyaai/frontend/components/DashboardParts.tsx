import Link from 'next/link';
import type { DashboardFollowUp, DashboardScreening, Patient } from '@/types/api';
import { SCREENING_LABEL, formatDate, formatPercent, predictionLabel, whenText } from '@/lib/format';
import { EmptyState, FollowUpStatusText, RiskBadge } from './ui';
import { IconChevron } from './Icons';

/** One horizontal panel of key numbers, split by dividers. */
export function StatStrip({ items }: { items: { label: string; value: number | string; tone?: string; href?: string }[] }) {
  return (
    <div className="panel grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
      {items.map((s) => {
        const inner = (
          <>
            <div className={`text-3xl font-semibold tabular-nums ${s.tone || 'text-ink'}`}>{s.value}</div>
            <div className="text-sm text-muted">{s.label}</div>
          </>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="px-5 py-4 hover:bg-neem-50">
            {inner}
          </Link>
        ) : (
          <div key={s.label} className="px-5 py-4">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Low / Moderate / High distribution as one stacked bar with a legend. */
export function RiskSummary({ risk }: { risk: { high: number; moderate: number; low: number } }) {
  const total = risk.high + risk.moderate + risk.low;
  const parts = [
    { key: 'High', value: risk.high, color: 'bg-risk-high' },
    { key: 'Moderate', value: risk.moderate, color: 'bg-turmeric-500' },
    { key: 'Low', value: risk.low, color: 'bg-risk-low' },
  ];
  return (
    <div className="panel p-5">
      {total === 0 ? (
        <p className="text-muted">No screening results yet.</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-paper" role="img" aria-label={`High ${risk.high}, moderate ${risk.moderate}, low ${risk.low}`}>
            {parts.map((p) => p.value > 0 && <div key={p.key} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />)}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {parts.map((p) => (
              <div key={p.key}>
                <dt className="flex items-center gap-1.5 text-sm text-muted">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
                  {p.key}
                </dt>
                <dd className="text-xl font-semibold tabular-nums">{p.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

/** Screenings per condition. */
export function ConditionSummary({ s }: { s: { anemia: number; jaundice: number; skin: number } }) {
  const rows = [
    { label: 'Anaemia', value: s.anemia },
    { label: 'Jaundice', value: s.jaundice },
    { label: 'Skin', value: s.skin },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="panel space-y-3 p-5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3">
          <span className="text-[15px]">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-neem-50">
            <span className="block h-full rounded-full bg-neem-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ScreeningRow({ s, patient, action }: { s: DashboardScreening; patient?: Patient; action?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {patient ? (
            <Link href={`/patients/${patient.id}`} className="hover:underline">
              {patient.name}
            </Link>
          ) : (
            `Patient #${s.patient_id}`
          )}
        </div>
        <div className="text-sm text-muted">
          {patient ? `${patient.patient_code}, ${patient.village}. ` : ''}
          {SCREENING_LABEL[s.screening_type] || s.screening_type} screening, {formatDate(s.screening_date)}
        </div>
        {s.status === 'ANALYZED' && s.prediction ? (
          <div className="mt-0.5 text-[15px]">
            {predictionLabel(s.prediction, s.screening_type)}
            {s.confidence !== null && <span className="text-muted">, {formatPercent(s.confidence)} confidence</span>}
          </div>
        ) : (
          <div className="mt-0.5 text-sm text-muted">
            {s.status === 'QUALITY_FAILED' ? 'Photo failed the quality check' : 'Waiting for analysis'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <RiskBadge level={s.risk_level} />
        {action}
      </div>
    </li>
  );
}

export function FollowUpList({
  items,
  byId,
  empty,
}: {
  items: DashboardFollowUp[];
  byId: Map<number, Patient>;
  empty: string;
}) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="panel divide-y divide-line">
      {items.map((f) => {
        const p = byId.get(f.patient_id);
        const open = f.status !== 'COMPLETED' && f.status !== 'CANCELLED';
        return (
          <li key={f.id}>
            <Link href={`/patients/${f.patient_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neem-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p ? p.name : `Patient #${f.patient_id}`}</span>
                <span className="block truncate text-sm text-muted">
                  {formatDate(f.scheduled_date)}
                  {p ? `, ${p.village}` : ''}
                  {f.priority && f.priority !== 'NORMAL' ? `, ${f.priority.toLowerCase()} priority` : ''}
                </span>
                {f.notes?.startsWith('ANM REVIEW') && (
                  <span className="mt-1 block truncate rounded bg-turmeric-100 px-2 py-0.5 text-sm">{f.notes}</span>
                )}
              </span>
              <span className="text-right">
                <FollowUpStatusText status={f.status} />
                {open && f.status === 'PENDING' && <span className="block text-xs text-muted">{whenText(f.scheduled_date)}</span>}
              </span>
              <IconChevron size={18} className="text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
