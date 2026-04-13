'use client';

import { useEffect, useState } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('[App Error]', error);
    console.error('[App Error Stack]', error.stack);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-lg text-center p-8">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Try again
          </button>
          <button
            onClick={() => setShowDetails(prev => !prev)}
            className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--surface-elevated)] transition-colors text-sm"
          >
            {showDetails ? 'Hide' : 'Show'} details
          </button>
        </div>
        {showDetails && error.stack && (
          <pre className="mt-4 p-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-xs text-left text-[var(--text-secondary)] overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-words">
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  );
}
