const SCORE_STYLES: Record<string, string> = {
  Hot: 'bg-red-100 text-red-800',
  Warm: 'bg-orange-100 text-orange-800',
  Cold: 'bg-blue-100 text-blue-800',
  Dead: 'bg-gray-100 text-gray-500',
};

export default function ScoreBadge({ score, category }: { score: number; category: string }) {
  const styles = SCORE_STYLES[category] || 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      <span>{score}</span>
      <span className="opacity-70">·</span>
      <span>{category}</span>
    </span>
  );
}
