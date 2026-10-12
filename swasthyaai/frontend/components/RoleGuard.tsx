'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardPath, useAuth } from '@/lib/auth';
import type { AppRole } from '@/types/api';
import { Spinner } from './ui';

/** Shows children only to the listed roles; others go to their own dashboard. */
export function RoleGuard({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role as AppRole);

  useEffect(() => {
    if (user && !allowed) router.replace(dashboardPath(user.role));
  }, [user, allowed, router]);

  if (!allowed) return <Spinner />;
  return <>{children}</>;
}
