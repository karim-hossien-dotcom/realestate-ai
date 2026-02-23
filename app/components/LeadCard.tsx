'use client';

import type { Lead } from '@/app/lib/supabase/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StatusBadge from './StatusBadge';
import ScoreBadge from './ScoreBadge';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

type LeadCardProps = {
  lead: Lead;
  onClick: (lead: Lead) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
};

export default function LeadCard({ lead, onClick, selected, onSelect }: LeadCardProps) {
  const initial = (lead.owner_name || lead.email || '?').charAt(0).toUpperCase();

  return (
    <div
      onClick={() => onClick(lead)}
      className={`bg-white dark:bg-gray-800 border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
        selected ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(lead.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {lead.owner_name || 'Unknown'}
            </h4>
            <ScoreBadge score={lead.score} category={lead.score_category} />
          </div>
          {lead.property_address && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              <i className="fas fa-map-marker-alt mr-1"></i>
              {lead.property_address}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            {lead.phone && (
              <span><i className="fas fa-phone mr-1"></i>{lead.phone}</span>
            )}
            {lead.email && (
              <span className="truncate"><i className="fas fa-envelope mr-1"></i>{lead.email}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={lead.status} />
            {lead.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                {tag}
              </span>
            ))}
            {(lead.tags?.length || 0) > 3 && (
              <span className="text-xs text-gray-400">+{lead.tags.length - 3}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Last contact: {timeAgo(lead.last_contacted)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Draggable wrapper for kanban view
export function DraggableLeadCard({ lead, onClick }: { lead: Lead; onClick: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  );
}

// Compact row version for table view
export function LeadRow({ lead, onClick, selected, onSelect }: LeadCardProps) {
  const initial = (lead.owner_name || lead.email || '?').charAt(0).toUpperCase();

  return (
    <tr
      onClick={() => onClick(lead)}
      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 transition-colors"
    >
      {onSelect && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(lead.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{lead.owner_name || 'Unknown'}</p>
            {lead.property_address && (
              <p className="text-xs text-gray-500 truncate">{lead.property_address}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.phone || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{lead.email || '—'}</td>
      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
      <td className="px-4 py-3"><ScoreBadge score={lead.score} category={lead.score_category} /></td>
      <td className="px-4 py-3 text-xs text-gray-400 hidden xl:table-cell">{timeAgo(lead.last_contacted)}</td>
    </tr>
  );
}
