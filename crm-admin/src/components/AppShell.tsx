'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, ChevronLeft, ChevronRight, LayoutDashboard, LogOut, Megaphone, Users, Wrench } from 'lucide-react';
import { useState } from 'react';
import Button from './ui/Button';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/segments', label: 'Segments', icon: BarChart3 },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/tools', label: 'Tools', icon: Wrench },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={`crm-shell ${collapsed ? 'crm-shell-collapsed' : ''}`}>
      <aside className="crm-sidebar p-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6f3145] text-sm font-bold">HG</div>
            {!collapsed ? <span className="text-base font-semibold">Haus of Growth</span> : null}
          </div>
          <button className="rounded-md p-1 hover:bg-white/10" onClick={() => setCollapsed((prev) => !prev)}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="space-y-4">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} title={item.label}>
              <div
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  pathname.startsWith(item.href) ? 'bg-white/15' : 'hover:bg-white/10'
                }`}
              >
                <item.icon size={16} />
                {!collapsed ? <span>{item.label}</span> : null}
              </div>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-5">
          <Button variant="danger" className="w-full" onClick={logout} loading={isLoggingOut}>
            <LogOut size={16} />
            {!collapsed ? 'Sign out' : ''}
          </Button>
        </div>
      </aside>
      <main className="crm-content">
        <div className="crm-card mb-3 flex items-center justify-between p-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#6f3145] text-xs font-bold text-white">HG</div>
            Haus of Growth CRM
          </h1>
        </div>
        <div className="p-4">
          {children}
        </div>
      </main>
    </div>
  );
}
