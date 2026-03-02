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
      <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-lg z-50 md:hidden transform transition-transform duration-300 ease-in-out">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-home text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Estate AI</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Agent Assistant</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <nav className="mt-6 px-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'text-blue-600 bg-blue-50'
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

        {/* User Profile & Sign out */}
        <div className="absolute bottom-0 left-0 w-64 border-t border-gray-200 bg-white">
          {/* User Profile */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                {profile.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{profile.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{profile.displayCompany}</p>
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
              className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg text-sm"
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
