'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/prototype/dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
  { href: '/prototype/leads', label: 'Leads', icon: 'fa-users' },
  { href: '/prototype/campaigns', label: 'Campaigns', icon: 'fa-bullhorn' },
  { href: '/prototype/follow-ups', label: 'Follow-Ups', icon: 'fa-clock' },
  { href: '/prototype/conversations', label: 'Conversations', icon: 'fa-comments' },
  { href: '/prototype/calendar', label: 'Calendar', icon: 'fa-calendar' },
  { href: '/prototype/logs', label: 'Logs', icon: 'fa-file-alt' },
  { href: '/prototype/settings', label: 'Settings', icon: 'fa-cog' },
];

// Pages that still use iframes (have their own navigation)
const iframePages = [
  '/prototype/leads',
  '/prototype/campaigns',
  '/prototype/follow-ups',
  '/prototype/conversations',
  '/prototype/logs',
  '/prototype/settings',
];

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Skip layout for iframe pages (they have their own navigation)
  if (pathname === '/prototype' || iframePages.includes(pathname)) {
    return <div className="w-screen h-screen">{children}</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-home text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RealEstate AI</h1>
              <p className="text-sm text-gray-500">Agent Assistant</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 px-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'text-primary bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <i className={`fas ${item.icon} w-5 mr-3`}></i>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sign out button */}
        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-200 bg-white">
          <button
            onClick={async () => {
              const { createClient } = await import('@/app/lib/supabase/client');
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            <i className="fas fa-sign-out-alt w-5 mr-3"></i>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
