'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/pnl', label: 'P&L' },
  { href: '/cashflow', label: 'Cash Flow' },
  { href: '/salary', label: 'Salary' },
  { href: '/tent', label: 'TENT' },
  { href: '/assumptions', label: 'Assumptions' },
  { href: '/kpi', label: 'KPIs' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-emerald-400 font-black text-xl tracking-tight">⚡ BETMAN</span>
            <span className="text-slate-500 text-sm font-semibold hidden sm:block">HQ</span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
