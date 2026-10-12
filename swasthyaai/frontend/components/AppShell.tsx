'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { ROLE_NAMES, dashboardPath, useAuth } from '@/lib/auth';
import type { AppRole } from '@/types/api';
import { initials } from '@/lib/format';
import {
  IconBell,
  IconCamera,
  IconHome,
  IconLeaf,
  IconLogout,
  IconQr,
  IconUser,
  IconUserPlus,
  IconUsers,
} from './Icons';

interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  mobile?: boolean;
}

const NAV: Record<AppRole, NavItem[]> = {
  ADMIN: [
    { href: '/admin/users', label: 'Health workers', short: 'Workers', icon: IconUsers, mobile: true },
    { href: '/profile', label: 'Profile', icon: IconUser, mobile: true },
  ],
  ASHA: [
    { href: '/dashboard/asha', label: 'Dashboard', short: 'Home', icon: IconHome, mobile: true },
    { href: '/patients', label: 'Patients', icon: IconUsers, mobile: true },
    { href: '/patients/new', label: 'Add new person', icon: IconUserPlus },
    { href: '/screening/capture', label: 'Start screening', short: 'Screen', icon: IconCamera, mobile: true },
    { href: '/qr-scan', label: 'Scan QR', icon: IconQr, mobile: true },
    { href: '/reminders', label: 'Follow-ups', icon: IconBell, mobile: true },
    { href: '/profile', label: 'Profile', icon: IconUser },
  ],
  ANM: [
    { href: '/dashboard/anm', label: 'Dashboard', short: 'Home', icon: IconHome, mobile: true },
    { href: '/patients', label: 'Patients', icon: IconUsers, mobile: true },
    { href: '/reminders', label: 'Follow-ups', icon: IconBell, mobile: true },
    { href: '/qr-scan', label: 'Scan QR', icon: IconQr, mobile: true },
    { href: '/profile', label: 'Profile', icon: IconUser, mobile: true },
  ],
};

function isActive(pathname: string, href: string) {
  if (href === '/patients') return pathname === '/patients' || /^\/patients\/\d+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const role = user.role as AppRole;
  const items = NAV[role];
  const mobileItems = items.filter((i) => i.mobile);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-neem-800 text-white md:flex">
        <Link href={dashboardPath(role)} className="flex items-center gap-2 px-5 py-5 text-lg font-semibold">
          <IconLeaf className="text-turmeric-300" /> SwasthyaAI
        </Link>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${
                  active ? 'bg-neem-700 font-semibold text-white' : 'text-neem-100 hover:bg-neem-700/60'
                }`}
              >
                <item.icon size={20} className={active ? 'text-turmeric-300' : ''} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-neem-700 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neem-600 font-semibold">{initials(user.name)}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-medium">{user.name}</div>
              <div className="truncate text-sm text-neem-200">
                {ROLE_NAMES[role]}
                {user.village ? `, ${user.village}` : ''}
              </div>
            </div>
            <button onClick={logout} className="rounded-md p-2 text-neem-100 hover:bg-neem-700" aria-label="Sign out" title="Sign out">
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-neem-800 px-4 text-white md:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <Link href={dashboardPath(role)} className="flex items-center gap-2 font-semibold">
            <IconLeaf className="text-turmeric-300" /> SwasthyaAI
          </Link>
          <span className="ml-auto truncate text-sm text-neem-100">{ROLE_NAMES[role]}</span>
          <button onClick={logout} className="rounded-md p-2 text-neem-100 hover:bg-neem-700" aria-label="Sign out">
            <IconLogout />
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">{children}</main>

        {/* Mobile bottom navigation */}
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Main"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }}>
            {mobileItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? 'font-semibold text-neem-700' : 'text-muted'}`}
                >
                  <item.icon size={22} />
                  {item.short || item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
