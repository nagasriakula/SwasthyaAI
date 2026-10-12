'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ROLE_NAMES, dashboardPath, useAuth } from '@/lib/auth';
import type { AppRole } from '@/types/api';
import { ErrorState, Spinner } from '@/components/ui';
import { IconBack, IconChevron, IconLeaf, IconShield, IconStethoscope, IconUsers } from '@/components/Icons';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type FormValues = z.infer<typeof schema>;

const ROLES: { role: AppRole; text: string; icon: typeof IconUsers }[] = [
  { role: 'ASHA', text: 'Register patients, capture eye and skin photos, and run screening.', icon: IconUsers },
  { role: 'ANM', text: 'Review high-risk patients, check results and manage follow-ups.', icon: IconStethoscope },
  { role: 'ADMIN', text: 'Supervisor: create and manage ASHA and ANM accounts.', icon: IconShield },
];

// Demo accounts created by backend/create_demo_users.py.
// Hidden unless NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true is set in .env.local (for a presentation).
// The admin login is never shown on screen.
const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true';
const DEMO: Record<AppRole, { email: string; password: string }> = {
  ASHA: { email: 'asha@swasthyaai.com', password: 'Asha@12345' },
  ANM: { email: 'anm@swasthyaai.com', password: 'Anm@12345' },
  ADMIN: { email: 'admin@swasthyaai.com', password: 'Admin@12345' },
};

function LoginContent() {
  const { user, status, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AppRole | null>(null);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === 'authenticated') router.replace(dashboardPath(user?.role));
  }, [status, user, router]);

  async function onSubmit(values: FormValues) {
    if (!role) return;
    setError('');
    try {
      const me = await login(role, values.email, values.password);
      router.replace(dashboardPath(me.role));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Try again.');
    }
  }

  if (status !== 'anonymous') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.15fr]">
      <aside className="flex flex-col justify-between bg-neem-800 px-6 py-8 text-white sm:px-10 lg:py-12">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <IconLeaf className="text-turmeric-300" /> SwasthyaAI
        </div>
        <div className="my-8 lg:my-0">
          <h1 className="max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
            Screening at the doorstep. High-risk cases reach the ANM the same day.
          </h1>
          <ul className="mt-6 hidden max-w-md space-y-2 text-neem-100 sm:block">
            <li>Anaemia and jaundice screening from eye photos, skin screening from skin photos.</li>
            <li>Every result shows its confidence and the image areas the model focused on.</li>
            <li>Each patient gets a QR health card linked to their screening history.</li>
          </ul>
        </div>
        <p className="hidden text-sm text-neem-200 lg:block">
          AI-assisted preliminary screening. It does not replace a medical diagnosis.
        </p>
      </aside>

      <main className="flex items-start justify-center px-5 py-10 sm:px-10 lg:items-center">
        <div className="w-full max-w-md">
          {params.get('expired') && !role && (
            <div className="mb-5 rounded-lg bg-turmeric-100 px-4 py-3">Your session ended. Sign in again to continue.</div>
          )}

          {!role ? (
            <>
              <h2 className="text-2xl font-semibold">Sign in as</h2>
              <p className="mt-1 text-muted">Choose your role to continue.</p>
              <div className="mt-6 space-y-3">
                {ROLES.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => setRole(r.role)}
                    className="flex w-full items-center gap-4 rounded-xl bg-white p-5 text-left ring-1 ring-line transition-colors hover:ring-2 hover:ring-neem-500"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neem-50 text-neem-700">
                      <r.icon size={24} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-lg font-semibold">{ROLE_NAMES[r.role]}</span>
                      <span className="block text-[15px] text-muted">{r.text}</span>
                    </span>
                    <IconChevron className="text-muted" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setRole(null);
                  setError('');
                }}
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neem-700 hover:underline"
              >
                <IconBack size={16} /> Change role
              </button>
              <h2 className="text-2xl font-semibold">Sign in as {ROLE_NAMES[role]}</h2>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input id="email" type="email" autoComplete="username" className="input" aria-invalid={!!errors.email} autoFocus {...register('email')} />
                  {errors.email && <p className="field-error">{errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <input id="password" type="password" autoComplete="current-password" className="input" aria-invalid={!!errors.password} {...register('password')} />
                  {errors.password && <p className="field-error">{errors.password.message}</p>}
                </div>
                {error && <ErrorState message={error} />}
                <button type="submit" className="btn btn-primary w-full py-3" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in' : 'Sign in'}
                </button>
              </form>

              {SHOW_DEMO_ACCOUNTS && role !== 'ADMIN' && (
                <p className="mt-5 rounded-lg bg-neem-50 px-4 py-3 text-sm text-muted">
                  Demo account: <span className="font-medium text-ink">{DEMO[role].email}</span> /{' '}
                  <span className="font-medium text-ink">{DEMO[role].password}</span>
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
