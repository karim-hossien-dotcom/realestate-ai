'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import MobileNav from '@/app/components/MobileNav';
import ToastProvider from '@/app/components/ToastProvider';
import ThemeProvider, { useTheme } from '@/app/components/ThemeProvider';

type Profile = {
  full_name: string | null;
  email: string;
  company: string | null;
};

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

// All pages are now React components (no more iframes)
const iframePages: string[] = [];

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Fetch user profile
  useEffect(() => {
    fetch('/api/settings/profile')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.profile) {
          setProfile(data.profile);
        }
      })
      .catch(console.error);
  }, []);

  // Close mobile nav when route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    const { createClient } = await import('@/app/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // Skip layout for settings page which has its own full layout
  if (pathname === '/prototype' || iframePages.includes(pathname) || pathname === '/prototype/settings') {
    return <ThemeProvider><ToastProvider><div className="w-screen h-screen">{children}</div></ToastProvider></ThemeProvider>;
  }

  const displayName = profile?.full_name || profile?.email || 'Loading...';
  const displayCompany = profile?.company || 'Real Estate Agent';
  const initial = displayName.charAt(0).toUpperCase();

  const profileData = { displayName, displayCompany, initial };

  return (
    <ThemeProvider>
    <ToastProvider>
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Nav */}
      <MobileNav
        navItems={navItems}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        profile={profileData}
        onSignOut={handleSignOut}
      />

      {/* Desktop Sidebar - collapsible on hover */}
      <aside
        className={`hidden md:flex bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex-col transition-all duration-300 ${
          sidebarExpanded ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${sidebarExpanded ? 'px-6' : 'px-3'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-home text-white text-lg"></i>
            </div>
            {sidebarExpanded && (
              <div className="overflow-hidden">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">RealEstate AI</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Agent Assistant</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`mt-6 flex-1 overflow-y-auto ${sidebarExpanded ? 'px-4' : 'px-2'}`}>
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center py-3 rounded-lg transition-colors ${
                      sidebarExpanded ? 'px-4' : 'px-3 justify-center'
                    } ${
                      isActive
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title={!sidebarExpanded ? item.label : undefined}
                  >
                    <i className={`fas ${item.icon} ${sidebarExpanded ? 'w-5 mr-3' : 'text-lg'}`}></i>
                    {sidebarExpanded && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile, Theme Toggle & Sign out */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* User Profile */}
          <div className={`p-3 border-b border-gray-100 dark:border-gray-700 ${sidebarExpanded ? 'px-4' : ''}`}>
            <div className={`flex items-center ${sidebarExpanded ? 'space-x-3' : 'justify-center'}`}>
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {initial}
              </div>
              {sidebarExpanded && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayCompany}</p>
                </div>
              )}
            </div>
          </div>
          {/* Theme toggle + Sign out */}
          <div className="p-2 space-y-1">
            <ThemeToggleButton expanded={sidebarExpanded} />
            <button
              onClick={handleSignOut}
              className={`flex items-center w-full py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm ${
                sidebarExpanded ? 'px-4' : 'justify-center px-2'
              }`}
              title={!sidebarExpanded ? 'Sign Out' : undefined}
            >
              <i className={`fas fa-sign-out-alt ${sidebarExpanded ? 'w-5 mr-3' : 'text-lg'}`}></i>
              {sidebarExpanded && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with hamburger menu on mobile */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 md:hidden">
          <div className="flex items-center justify-between">
            {/* Hamburger menu */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>

            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-home text-white text-sm"></i>
              </div>
              <span className="font-bold text-gray-900 dark:text-gray-100">RealEstate AI</span>
            </div>

            {/* User profile - mobile */}
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {initial}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
    </ThemeProvider>
  );
}

function ThemeToggleButton({ expanded }: { expanded: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center w-full py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm ${
        expanded ? 'px-4' : 'justify-center px-2'
      }`}
      title={!expanded ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
    >
      <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} ${expanded ? 'w-5 mr-3' : 'text-lg'}`}></i>
      {expanded && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
}
