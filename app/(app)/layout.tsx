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
  { href: '/dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
  { href: '/leads', label: 'Leads', icon: 'fa-users' },
  { href: '/campaigns', label: 'Campaigns', icon: 'fa-bullhorn' },
  { href: '/follow-ups', label: 'Follow-Ups', icon: 'fa-clock' },
  { href: '/conversations', label: 'Conversations', icon: 'fa-comments' },
  { href: '/calendar', label: 'Calendar', icon: 'fa-calendar' },
  { href: '/logs', label: 'Logs', icon: 'fa-file-alt' },
  { href: '/settings', label: 'Settings', icon: 'fa-cog' },
  { href: '/test-playbook', label: 'Test Playbook', icon: 'fa-flask' },
];

// All pages are now React components (no more iframes)
const iframePages: string[] = [];

export default function AppLayout({
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

  // Skip layout for full-screen pages
  if (iframePages.includes(pathname)) {
    return <ThemeProvider><ToastProvider><div className="w-screen h-screen">{children}</div></ToastProvider></ThemeProvider>;
  }

  const displayName = profile?.full_name || profile?.email || 'Loading...';
  const displayCompany = profile?.company || 'Real Estate Agent';
  const initial = displayName.charAt(0).toUpperCase();

  const profileData = { displayName, displayCompany, initial };

  return (
    <ThemeProvider>
    <ToastProvider>
    <div className="flex h-screen bg-[var(--background)]">
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
        className={`hidden md:flex bg-[var(--surface)] dark:bg-[#141827] border-r border-[var(--border)] flex-shrink-0 flex-col transition-all duration-300 ${
          sidebarExpanded ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className={`p-4 border-b border-[var(--border)] ${sidebarExpanded ? 'px-6' : 'px-3'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm dark:shadow-[0_0_12px_rgba(79,123,247,0.2)]">
              <i className="fas fa-home text-white text-lg"></i>
            </div>
            {sidebarExpanded && (
              <div className="overflow-hidden">
                <h1 className="text-xl font-heading font-bold text-[var(--text-primary)] whitespace-nowrap">Estate AI</h1>
                <p className="text-sm text-[var(--text-secondary)] whitespace-nowrap">Agent Assistant</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`mt-4 flex-1 overflow-y-auto ${sidebarExpanded ? 'px-2' : 'px-2'}`}>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center py-2 rounded-lg transition-colors relative border-l-[3px] ${
                      sidebarExpanded ? 'px-3 gap-3' : 'px-2 justify-center'
                    } ${
                      isActive
                        ? 'text-[var(--primary)] bg-blue-50 dark:bg-blue-500/10 border-[var(--primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] border-transparent'
                    }`}
                    title={!sidebarExpanded ? item.label : undefined}
                  >
                    <i className={`fas fa-fw ${item.icon} ${sidebarExpanded ? '' : 'text-lg'}`}></i>
                    {sidebarExpanded && <span className="whitespace-nowrap text-sm">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile, Theme Toggle & Sign out */}
        <div className="border-t border-[var(--border)] bg-[var(--surface)] dark:bg-[#141827]">
          {/* User Profile */}
          <div className={`p-3 border-b border-[var(--border)] ${sidebarExpanded ? 'px-4' : ''}`}>
            <div className={`flex items-center ${sidebarExpanded ? 'space-x-3' : 'justify-center'}`}>
              <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {initial}
              </div>
              {sidebarExpanded && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{displayName}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{displayCompany}</p>
                </div>
              )}
            </div>
          </div>
          {/* Theme toggle + Sign out */}
          <div className="p-2 space-y-1">
            <ThemeToggleButton expanded={sidebarExpanded} />
            <button
              onClick={handleSignOut}
              className={`flex items-center w-full py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] rounded-lg text-sm transition-colors ${
                sidebarExpanded ? 'px-3 gap-3' : 'justify-center px-2'
              }`}
              title={!sidebarExpanded ? 'Sign Out' : undefined}
            >
              <i className={`fas fa-fw fa-sign-out-alt ${sidebarExpanded ? '' : 'text-lg'}`}></i>
              {sidebarExpanded && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with hamburger menu on mobile */}
        <header className="bg-[var(--surface)] dark:bg-[#141827] border-b border-[var(--border)] px-4 md:px-6 py-3 md:hidden">
          <div className="flex items-center justify-between">
            {/* Hamburger menu */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>

            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] rounded-lg flex items-center justify-center">
                <i className="fas fa-home text-white text-sm"></i>
              </div>
              <span className="font-heading font-bold text-[var(--text-primary)]">Estate AI</span>
            </div>

            {/* User profile - mobile */}
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] rounded-full flex items-center justify-center text-white text-sm font-semibold">
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
      className={`flex items-center w-full py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] rounded-lg text-sm transition-colors ${
        expanded ? 'px-3 gap-3' : 'justify-center px-2'
      }`}
      title={!expanded ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
    >
      <i className={`fas fa-fw ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} ${expanded ? '' : 'text-lg'}`}></i>
      {expanded && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
}
