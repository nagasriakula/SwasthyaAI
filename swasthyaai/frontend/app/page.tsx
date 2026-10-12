'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardPath, useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

export default function Home() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace(dashboardPath(user?.role));
    if (status === 'anonymous') router.replace('/login');
  }, [status, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
