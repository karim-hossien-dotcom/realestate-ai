const SCORE_STYLES: Record<string, string> = {
  Hot: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  Warm: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  Cold: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  Dead: 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-500',
};

export default function ScoreBadge({ score, category }: { score: number; category: string }) {
  const styles = SCORE_STYLES[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      <span>{score}</span>
      <span className="opacity-70">·</span>
      <span>{category}</span>
    </span>
  );
}
