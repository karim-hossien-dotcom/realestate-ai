'use client';

import { useState, useEffect } from 'react';
import type { Lead } from '@/app/lib/supabase/types';
import StatusBadge, { STATUS_LABELS } from './StatusBadge';
import ScoreBadge from './ScoreBadge';
import { useToast } from './ToastProvider';

type LeadDetailPanelProps = {
  lead: Lead;
  onClose: () => void;
  onUpdate: (updatedLead: Lead) => void;
  onDelete: (id: string) => void;
};

export default function LeadDetailPanel({ lead, onClose, onUpdate, onDelete }: LeadDetailPanelProps) {
  const { showToast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    status: lead.status,
    notes: lead.notes || '',
    owner_name: lead.owner_name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    property_address: lead.property_address || '',
    contact_preference: lead.contact_preference || 'sms',
  });

  // Sync form when lead prop changes
  useEffect(() => {
    setForm({
      status: lead.status,
      notes: lead.notes || '',
      owner_name: lead.owner_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      property_address: lead.property_address || '',
      contact_preference: lead.contact_preference || 'sms',
    });
    setEditMode(false);
  }, [lead.id, lead.status, lead.notes, lead.owner_name, lead.phone, lead.email, lead.property_address, lead.contact_preference]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        onUpdate({ ...lead, ...form });
        showToast('Lead updated', 'success');
        setEditMode(false);
      } else {
        showToast(data.error || 'Failed to update lead', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setForm(prev => ({ ...prev, status: newStatus }));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        onUpdate({ ...lead, status: newStatus });
        showToast(`Status changed to ${STATUS_LABELS[newStatus] || newStatus}`, 'success');
      } else {
        showToast(data.error || 'Failed to update status', 'error');
        setForm(prev => ({ ...prev, status: lead.status }));
      }
    } catch {
      showToast('Network error', 'error');
      setForm(prev => ({ ...prev, status: lead.status }));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads?id=${lead.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        showToast('Lead deleted', 'success');
        onDelete(lead.id);
        onClose();
      } else {
        showToast(data.error || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = async (action: string, payload?: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/leads/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, action, ...payload }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Action "${action.replace(/_/g, ' ')}" completed`, 'success');
        if (action === 'add_to_dnc') {
          onUpdate({ ...lead, status: 'do_not_contact' });
        }
      } else {
        showToast(data.error || 'Action failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  };

  const initial = (lead.owner_name || lead.email || '?').charAt(0).toUpperCase();
  const statuses = Object.keys(STATUS_LABELS);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>

      {/* Panel */}
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-lg shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {initial}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{lead.owner_name || 'Unknown'}</h2>
              <ScoreBadge score={lead.score} category={lead.score_category} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <i className="fas fa-edit mr-1"></i>Edit
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contact Info</h3>
            {editMode ? (
              <>
                <input
                  value={form.owner_name}
                  onChange={(e) => setForm(prev => ({ ...prev, owner_name: e.target.value }))}
                  placeholder="Full Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  value={form.property_address}
                  onChange={(e) => setForm(prev => ({ ...prev, property_address: e.target.value }))}
                  placeholder="Property Address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </>
            ) : (
              <div className="space-y-2 text-sm">
                <InfoRow icon="fa-user" label="Name" value={lead.owner_name} />
                <InfoRow icon="fa-phone" label="Phone" value={lead.phone} />
                <InfoRow icon="fa-envelope" label="Email" value={lead.email} />
                <InfoRow icon="fa-map-marker-alt" label="Address" value={lead.property_address} />
                <InfoRow icon="fa-paper-plane" label="Preference" value={lead.contact_preference} />
              </div>
            )}
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h3>
            {editMode ? (
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add notes about this lead..."
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {lead.notes || 'No notes yet.'}
              </p>
            )}
          </div>

          {/* Generated Messages */}
          {(lead.sms_text || lead.email_text) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Generated Messages</h3>
              {lead.sms_text && (
                <div className="bg-gray-50 rounded-lg p-3 mb-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">SMS/WhatsApp</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{lead.sms_text}</p>
                </div>
              )}
              {lead.email_text && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Email</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{lead.email_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
            <p>Created: {new Date(lead.created_at).toLocaleDateString()}</p>
            <p>Updated: {new Date(lead.updated_at).toLocaleDateString()}</p>
            {lead.last_contacted && <p>Last contacted: {new Date(lead.last_contacted).toLocaleString()}</p>}
            {lead.last_response && <p>Last response: {new Date(lead.last_response).toLocaleString()}</p>}
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAction('schedule_meeting')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <i className="fas fa-calendar-plus"></i>Schedule Meeting
              </button>
              <button
                onClick={() => handleAction('add_followup')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <i className="fas fa-clock"></i>Add Follow-Up
              </button>
              <button
                onClick={() => window.location.href = `/prototype/conversations?leadId=${lead.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <i className="fas fa-comments"></i>View Messages
              </button>
              <button
                onClick={() => handleAction('add_to_dnc')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
              >
                <i className="fas fa-ban"></i>Add to DNC
              </button>
            </div>
          </div>

          {/* Delete */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <i className="fas fa-trash-alt mr-1"></i>
              {deleting ? 'Deleting...' : 'Delete this lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <i className={`fas ${icon} w-4 text-gray-400 text-center`}></i>
      <span className="text-gray-500 w-20">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 flex-1 truncate">{value || '—'}</span>
    </div>
  );
}
