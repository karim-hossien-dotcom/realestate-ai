'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept(value: 'all' | 'essential') {
    localStorage.setItem('cookie-consent', value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 sm:px-6 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-300 text-center sm:text-left">
          We use cookies for essential site functionality and secure payments.
          Read our{' '}
          <Link href="/cookies" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 underline">
            Cookie Policy
          </Link>{' '}
          for details.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => accept('essential')}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Essential Only
          </button>
          <button
            onClick={() => accept('all')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
