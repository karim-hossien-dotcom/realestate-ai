export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden animate-pulse">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex gap-6">
        {[120, 80, 140, 100, 60, 60].map((w, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }}></div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 border-t border-gray-100 flex items-center gap-6">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-36"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16"></div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 dark:bg-gray-700 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        ></div>
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 10 }: { size?: number }) {
  return (
    <div
      className="bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0"
      style={{ width: size * 4, height: size * 4 }}
    ></div>
  );
}
