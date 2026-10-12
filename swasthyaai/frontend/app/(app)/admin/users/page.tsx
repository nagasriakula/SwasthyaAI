'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/types/api';
import { RoleGuard } from '@/components/RoleGuard';
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { IconSearch, IconUserPlus } from '@/components/Icons';

const schema = z
  .object({
  name: z.string().trim().min(2, 'Enter the full name.').max(100),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'At least 8 characters.')
    .max(100)
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
  role: z.enum(['ASHA', 'ANM'], { errorMap: () => ({ message: 'Choose a role.' }) }),
  village: z.string().trim().max(100),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || /^[6-9]\d{9}$/.test(v), 'Enter a 10-digit mobile number, or leave it empty.'),
  anm_id: z.string(),
  })
  .refine((v) => v.role !== 'ASHA' || v.anm_id !== '', {
    path: ['anm_id'],
    message: 'Choose the ANM who supervises this ASHA worker.',
  });
type FormValues = z.infer<typeof schema>;

/** Readable temporary password, e.g. "Asha-4821-kpt". */
function suggestPassword(role: string) {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const letters = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 3).padEnd(3, 'x');
  return `${role === 'ANM' ? 'Anm' : 'Asha'}-${digits}-${letters}`;
}

const ROLE_LABEL: Record<string, string> = { ASHA: 'ASHA worker', ANM: 'ANM', ADMIN: 'Admin' };

function AddWorkerForm({ anms, onDone }: { anms: User[]; onDone: (u: User, password: string) => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: suggestPassword('ASHA'), role: 'ASHA', village: '', phone: '', anm_id: '' },
  });
  const role = watch('role');

  async function submit(v: FormValues) {
    setServerError('');
    try {
      const created = await api.createUser({
        name: v.name.trim(),
        email: v.email.trim().toLowerCase(),
        password: v.password,
        role: v.role,
        village: v.village.trim() || null,
        phone: v.phone.trim() || null,
        anm_id: v.role === 'ASHA' ? Number(v.anm_id) : null,
      });
      await qc.invalidateQueries({ queryKey: ['users'] });
      onDone(created, v.password);
      // Keep the same ANM selected: an admin often adds several ASHAs for one ANM.
      reset({ name: '', email: '', password: suggestPassword(v.role), role: v.role, village: '', phone: '', anm_id: v.anm_id });
    } catch (e) {
      setServerError(
        e instanceof ApiError && e.status === 409
          ? 'An account with this email already exists.'
          : e instanceof Error
            ? e.message
            : 'Could not create the account.'
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="panel space-y-4 p-5">
      <h2 className="text-lg font-semibold">Add health worker</h2>

      <div>
        <span className="label">Role</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
          {(['ASHA', 'ANM'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => {
                setValue('role', r);
                setValue('password', suggestPassword(r));
              }}
              className={`rounded-lg py-2.5 font-medium ring-1 ring-inset ${
                role === r ? 'bg-neem-700 text-white ring-neem-700' : 'bg-white ring-line hover:ring-neem-500'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {role === 'ASHA' && (
        <div>
          <label htmlFor="w-anm" className="label">Supervising ANM</label>
          {anms.length === 0 ? (
            <p className="rounded-lg bg-turmeric-100 px-3 py-2 text-[15px]">
              There is no active ANM yet. Create the ANM account first, then add her ASHA workers.
            </p>
          ) : (
            <select id="w-anm" className="input" {...register('anm_id')}>
              <option value="">Choose ANM</option>
              {anms.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.village ? `, ${a.village}` : ''}
                </option>
              ))}
            </select>
          )}
          {errors.anm_id && <p className="field-error">{errors.anm_id.message}</p>}
          <p className="mt-1 text-sm text-muted">Her screenings and high-risk cases go to this ANM only.</p>
        </div>
      )}

      <div>
        <label htmlFor="w-name" className="label">Full name</label>
        <input id="w-name" className="input" autoComplete="off" {...register('name')} />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="w-email" className="label">Email (used to sign in)</label>
        <input id="w-email" type="email" className="input" autoComplete="off" {...register('email')} />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="w-pass" className="label">Temporary password</label>
        <div className="flex gap-2">
          <input id="w-pass" className="input font-medium tracking-wide" autoComplete="new-password" {...register('password')} />
          <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setValue('password', suggestPassword(role))}>
            New
          </button>
        </div>
        {errors.password && <p className="field-error">{errors.password.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="w-village" className="label">Village / area</label>
          <input id="w-village" className="input" {...register('village')} />
        </div>
        <div>
          <label htmlFor="w-phone" className="label">Mobile (optional)</label>
          <input id="w-phone" type="tel" inputMode="numeric" maxLength={10} className="input" {...register('phone')} />
          {errors.phone && <p className="field-error">{errors.phone.message}</p>}
        </div>
      </div>

      {serverError && <ErrorState message={serverError} />}

      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting || (role === 'ASHA' && anms.length === 0)}>
        <IconUserPlus size={18} /> {isSubmitting ? 'Creating account' : 'Create account'}
      </button>
    </form>
  );
}

function AdminUsersContent() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ['users'], queryFn: api.users });
  const [search, setSearch] = useState('');
  const [created, setCreated] = useState<{ user: User; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = useMutation({
    mutationFn: (u: User) => api.setUserActive(u.id, !u.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const moveAsha = useMutation({
    mutationFn: ({ id, anmId }: { id: number; anmId: number | null }) => api.setUserAnm(id, anmId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const anms = useMemo(() => (users.data || []).filter((u) => u.role === 'ANM'), [users.data]);
  const activeAnms = useMemo(() => anms.filter((u) => u.active), [anms]);
  const anmById = useMemo(() => new Map(anms.map((a) => [a.id, a])), [anms]);
  const ashaCount = useMemo(() => {
    const m = new Map<number, number>();
    (users.data || []).forEach((u) => {
      if (u.role === 'ASHA' && u.active && u.anm_id) m.set(u.anm_id, (m.get(u.anm_id) || 0) + 1);
    });
    return m;
  }, [users.data]);
  const unassigned = (users.data || []).filter((u) => u.role === 'ASHA' && u.active && !u.anm_id).length;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data || [])
      .filter((u) => u.role !== 'ADMIN')
      .filter(
        (u) =>
          !q ||
          [u.name, u.email, u.village || '', u.role, (u.anm_id && anmById.get(u.anm_id)?.name) || ''].some((v) =>
            v.toLowerCase().includes(q)
          )
      )
      .sort((a, b) => Number(b.active) - Number(a.active) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  }, [users.data, search, anmById]);

  const counts = useMemo(() => {
    const all = (users.data || []).filter((u) => u.active);
    return { asha: all.filter((u) => u.role === 'ASHA').length, anm: all.filter((u) => u.role === 'ANM').length };
  }, [users.data]);

  async function copyDetails() {
    if (!created) return;
    const text = `SwasthyaAI login\nRole: ${ROLE_LABEL[created.user.role]}\nEmail: ${created.user.email}\nTemporary password: ${created.password}\nSign in at: ${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy these login details:', text);
    }
  }

  return (
    <div>
      <PageHeader
        title="Health workers"
        subtitle={`${counts.asha} active ASHA worker${counts.asha === 1 ? '' : 's'}, ${counts.anm} active ANM${counts.anm === 1 ? '' : 's'}. Only you can create accounts.`}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="order-2 lg:order-1">
          <div className="relative mb-4">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="input pl-10"
              placeholder="Search by name, email, village or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search health workers"
            />
          </div>

          {unassigned > 0 && (
            <p className="mb-4 rounded-lg bg-turmeric-100 px-4 py-3">
              {unassigned} ASHA worker{unassigned === 1 ? ' has' : 's have'} no supervising ANM. No ANM sees{' '}
              {unassigned === 1 ? 'her' : 'their'} patients until you choose one below.
            </p>
          )}

          {users.isLoading ? (
            <Spinner label="Loading accounts" />
          ) : users.error ? (
            <ErrorState message={(users.error as Error).message} onRetry={() => users.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState>{search ? `No accounts match “${search}”.` : 'No health worker accounts yet. Create the first one.'}</EmptyState>
          ) : (
            <ul className="panel divide-y divide-line">
              {list.map((u) => (
                <li key={u.id} className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center ${u.active ? '' : 'bg-paper'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold ${u.active ? '' : 'text-muted'}`}>{u.name}</span>
                      <span className="rounded-full bg-neem-50 px-2 py-0.5 text-xs font-medium text-neem-800">{ROLE_LABEL[u.role] || u.role}</span>
                      {!u.active && <span className="rounded-full bg-risk-highbg px-2 py-0.5 text-xs font-medium text-risk-high">Deactivated</span>}
                    </div>
                    <div className="truncate text-sm text-muted">
                      {u.email}
                      {u.village ? `, ${u.village}` : ''}
                      {u.phone ? `, ${u.phone}` : ''}
                    </div>
                    {u.role === 'ANM' && (
                      <div className="mt-0.5 text-sm text-muted">
                        Supervises {ashaCount.get(u.id) || 0} ASHA worker{ashaCount.get(u.id) === 1 ? '' : 's'}
                      </div>
                    )}
                    {u.role === 'ASHA' && (
                      <label className="mt-1.5 flex items-center gap-2 text-sm">
                        <span className="text-muted">ANM:</span>
                        <select
                          className={`rounded-md border px-2 py-1 text-sm ${u.anm_id ? 'border-line bg-white' : 'border-turmeric-500 bg-turmeric-100'}`}
                          value={u.anm_id ?? ''}
                          disabled={moveAsha.isPending}
                          aria-label={`Supervising ANM of ${u.name}`}
                          onChange={(e) => {
                            const anmId = e.target.value ? Number(e.target.value) : null;
                            const to = anmId ? anmById.get(anmId)?.name : 'no ANM';
                            if (window.confirm(`Move ${u.name} and all her patients to ${to}?`)) moveAsha.mutate({ id: u.id, anmId });
                          }}
                        >
                          <option value="">Not assigned</option>
                          {anms
                            .filter((a) => a.active || a.id === u.anm_id)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                                {a.active ? '' : ' (deactivated)'}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <button
                    className={`btn btn-sm ${u.active ? 'btn-ghost text-risk-high' : 'btn-secondary'}`}
                    disabled={toggle.isPending || u.id === me?.id}
                    onClick={() => {
                      const team = u.role === 'ANM' ? ashaCount.get(u.id) || 0 : 0;
                      const warning = team
                        ? `\n\nShe supervises ${team} ASHA worker${team === 1 ? '' : 's'}. Move them to another ANM afterwards, or their cases reach no ANM.`
                        : '';
                      if (!u.active || window.confirm(`Deactivate ${u.name}? They will no longer be able to sign in.${warning}`)) toggle.mutate(u);
                    }}
                  >
                    {u.active ? 'Deactivate' : 'Activate'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(toggle.error || moveAsha.error) && (
            <div className="mt-3">
              <ErrorState message={((toggle.error || moveAsha.error) as Error).message} />
            </div>
          )}
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          {created && (
            <div className="panel border-l-4 border-turmeric-500 p-5">
              <h2 className="font-semibold">Account created for {created.user.name}</h2>
              <p className="mt-1 text-sm text-muted">Share these details with the worker in person or by SMS. The password is shown only now.</p>
              <dl className="mt-3 space-y-1 text-[15px]">
                <div><dt className="inline text-muted">Email: </dt><dd className="inline font-medium">{created.user.email}</dd></div>
                <div><dt className="inline text-muted">Temporary password: </dt><dd className="inline font-medium tracking-wide">{created.password}</dd></div>
                {created.user.anm_id && (
                  <div><dt className="inline text-muted">Supervising ANM: </dt><dd className="inline font-medium">{anmById.get(created.user.anm_id)?.name}</dd></div>
                )}
              </dl>
              <div className="mt-3 flex gap-2">
                <button onClick={copyDetails} className="btn btn-secondary btn-sm">{copied ? 'Copied' : 'Copy login details'}</button>
                <button onClick={() => setCreated(null)} className="btn btn-ghost btn-sm">Done</button>
              </div>
            </div>
          )}
          <AddWorkerForm anms={activeAnms} onDone={(user, password) => setCreated({ user, password })} />
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGuard roles={['ADMIN']}>
      <AdminUsersContent />
    </RoleGuard>
  );
}
