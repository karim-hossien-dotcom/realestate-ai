const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  interested: 'bg-green-100 text-green-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  meeting_scheduled: 'bg-purple-100 text-purple-800',
  hot: 'bg-red-100 text-red-800',
  not_interested: 'bg-gray-100 text-gray-600',
  do_not_contact: 'bg-gray-100 text-gray-600',
  dead: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  qualified: 'Qualified',
  meeting_scheduled: 'Meeting',
  hot: 'Hot',
  not_interested: 'Not Interested',
  do_not_contact: 'DNC',
  dead: 'Dead',
};

export default function StatusBadge({ status }: { status: string }) {
  const styles = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700';
  const label = STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

// Export for use in dropdowns
export { STATUS_LABELS };
