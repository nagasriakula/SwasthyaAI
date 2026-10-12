'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from '@/lib/api';
import type { AppRole, User } from '@/types/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (role: AppRole, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ROLE_NAMES: Record<AppRole, string> = { ASHA: 'ASHA worker', ANM: 'ANM', ADMIN: 'Admin (supervisor)' };

export function isAppRole(role: string | undefined | null): role is AppRole {
  return role === 'ASHA' || role === 'ANM' || role === 'ADMIN';
}

export function dashboardPath(role: string | undefined | null) {
  if (role === 'ADMIN') return '/admin/users';
  return role === 'ANM' ? '/dashboard/anm' : '/dashboard/asha';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // Restore the session on first load
  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('anonymous');
      return;
    }
    api
      .me()
      .then((u) => {
        if (!isAppRole(u.role)) throw new Error('unsupported role');
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => {
        tokenStore.clear();
        setStatus('anonymous');
      });
  }, []);

  // Any 401 from the backend signs the user out
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
      router.replace('/login?expired=1');
    });
    return () => setUnauthorizedHandler(null);
  }, [router, queryClient]);

  const login = useCallback(async (role: AppRole, email: string, password: string) => {
    const { access_token } = await api.login(email.trim(), password);
    tokenStore.set(access_token);
    let me: User;
    try {
      me = await api.me();
    } catch (e) {
      tokenStore.clear();
      throw e;
    }
    if (me.role !== role) {
      tokenStore.clear();
      if (!isAppRole(me.role)) {
        throw new Error('This account is not an ASHA or ANM account. This account type cannot sign in to SwasthyaAI.');
      }
      throw new Error(`This account is registered as ${ROLE_NAMES[me.role]}. Go back and choose that role.`);
    }
    if (me.active === false) {
      tokenStore.clear();
      throw new Error('This account is inactive. Contact your supervisor.');
    }
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
    router.replace('/login');
  }, [router, queryClient]);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
