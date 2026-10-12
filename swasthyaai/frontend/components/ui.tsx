import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FollowUpStatus, RiskLevel } from '@/types/api';
import { FOLLOWUP_LABEL, RISK_LABEL } from '@/lib/format';
import { IconAlert, IconBack } from './Icons';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-neem-200 border-t-neem-700" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-risk-highbg px-4 py-3 text-risk-high" role="alert">
      <IconAlert className="mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

const RISK_STYLE: Record<RiskLevel, { badge: string; dot: string }> = {
  HIGH: { badge: 'bg-risk-highbg text-risk-high', dot: 'bg-risk-high' },
  MODERATE: { badge: 'bg-risk-moderatebg text-risk-moderate', dot: 'bg-turmeric-500' },
  LOW: { badge: 'bg-risk-lowbg text-risk-low', dot: 'bg-risk-low' },
};

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) {
    return <span className="inline-flex rounded-full bg-paper px-2.5 py-0.5 text-sm text-muted ring-1 ring-line">No result</span>;
  }
  const s = RISK_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${s.badge}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {RISK_LABEL[level]} risk
    </span>
  );
}

const FOLLOWUP_STYLE: Record<FollowUpStatus, string> = {
  PENDING: 'text-muted',
  DUE: 'text-risk-moderate font-medium',
  OVERDUE: 'text-risk-high font-medium',
  COMPLETED: 'text-risk-low',
  CANCELLED: 'text-muted line-through',
};

export function FollowUpStatusText({ status }: { status: FollowUpStatus }) {
  return <span className={`text-sm ${FOLLOWUP_STYLE[status] || 'text-muted'}`}>{FOLLOWUP_LABEL[status] || status}</span>;
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-neem-700 hover:underline">
            <IconBack size={16} /> Back
          </Link>
        )}
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-muted">{children}</div>;
}
