'use client';

import { ROLE_NAMES, useAuth } from '@/lib/auth';
import type { AppRole } from '@/types/api';
import { PageHeader } from '@/components/ui';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const rows = [
    { label: 'Name', value: user.name },
    { label: 'Role', value: ROLE_NAMES[user.role as AppRole] },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: user.phone || 'Not given' },
    { label: 'Village', value: user.village || 'Not given' },
  ];
  return (
    <div className="max-w-xl">
      <PageHeader title="Profile" />
      <dl className="panel divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[7rem_1fr] gap-3 px-5 py-3">
            <dt className="text-muted">{r.label}</dt>
            <dd className="font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      <button onClick={logout} className="btn btn-secondary mt-5">Sign out</button>
    </div>
  );
}
