export function SkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-[var(--surface-elevated)] rounded w-24"></div>
        <div className="h-8 w-8 bg-[var(--surface-elevated)] rounded-full"></div>
      </div>
      <div className="h-8 bg-[var(--surface-elevated)] rounded w-16 mb-2"></div>
      <div className="h-3 bg-[var(--surface-elevated)] rounded w-32"></div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden animate-pulse">
      {/* Header */}
      <div className="bg-[var(--surface-elevated)] px-6 py-3 flex gap-6">
        {[120, 80, 140, 100, 60, 60].map((w, i) => (
          <div key={i} className="h-3 bg-[var(--surface-elevated)] rounded" style={{ width: w }}></div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 border-t border-[var(--border)] flex items-center gap-6">
          <div className="h-8 w-8 bg-[var(--surface-elevated)] rounded-full flex-shrink-0"></div>
          <div className="h-3 bg-[var(--surface-elevated)] rounded w-28"></div>
          <div className="h-3 bg-[var(--surface-elevated)] rounded w-24"></div>
          <div className="h-3 bg-[var(--surface-elevated)] rounded w-36"></div>
          <div className="h-3 bg-[var(--surface-elevated)] rounded w-20"></div>
          <div className="h-5 bg-[var(--surface-elevated)] rounded-full w-16"></div>
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
          className="h-3 bg-[var(--surface-elevated)] rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        ></div>
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 10 }: { size?: number }) {
  return (
    <div
      className="bg-[var(--surface-elevated)] rounded-full animate-pulse flex-shrink-0"
      style={{ width: size * 4, height: size * 4 }}
    ></div>
  );
}
