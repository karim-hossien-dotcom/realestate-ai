'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type Props = {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
  profile: {
    displayName: string;
    displayCompany: string;
    initial: string;
  };
  onSignOut: () => void;
};

export default function MobileNav({ navItems, isOpen, onClose, profile, onSignOut }: Props) {
  const pathname = usePathname();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Slide-out drawer */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-[var(--surface)] dark:bg-[#141827] shadow-lg z-50 md:hidden transform transition-transform duration-300 ease-in-out">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] rounded-lg flex items-center justify-center shadow-sm dark:shadow-[0_0_12px_rgba(79,123,247,0.2)]">
                <i className="fas fa-home text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-[var(--text-primary)]">Estate AI</h1>
                <p className="text-sm text-[var(--text-secondary)]">Agent Assistant</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <nav className="mt-6 px-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-4 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'text-[var(--primary)] bg-blue-50 dark:bg-blue-500/10 border-l-[3px] border-[var(--primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]'
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

        {/* User Profile & Sign out */}
        <div className="absolute bottom-0 left-0 w-64 border-t border-[var(--border)] bg-[var(--surface)] dark:bg-[#141827]">
          {/* User Profile */}
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] rounded-full flex items-center justify-center text-white font-semibold">
                {profile.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{profile.displayName}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{profile.displayCompany}</p>
              </div>
            </div>
          </div>
          {/* Sign out button */}
          <div className="p-2">
            <button
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="flex items-center w-full px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] rounded-lg text-sm transition-colors"
            >
              <i className="fas fa-sign-out-alt w-5 mr-3"></i>
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
