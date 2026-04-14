'use client';

import { useState } from 'react';
import {
  CADENCE_TEMPLATES,
  DEFAULT_TEMPLATE_BY_LEAD_TYPE,
  type CadenceTemplate,
  type LeadType,
} from '@/app/lib/cadence/templates';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutomationMode = 'full_auto' | 'approval_required' | 'manual';

export type FollowupAutomationSettings = {
  followup_automation_mode: AutomationMode;
  followup_approval_window_hours: number;
  followup_default_template: string;
  followup_template_by_lead_type: Record<LeadType, string>;
  followup_quiet_hours_start: number;
  followup_quiet_hours_end: number;
  followup_tcpa_enabled: boolean;
  followup_skip_weekends: boolean;
  followup_max_touches: number;
};

export type CustomCadenceTemplate = {
  id: string;
  name: string;
  description: string | null;
  day_offsets: number[];
  lead_type: string | null;
  is_default: boolean;
  created_at: string;
};

type AutomationTabProps = {
  settings: FollowupAutomationSettings;
  customTemplates: CustomCadenceTemplate[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  hasChanges: boolean;
  onSettingsChange: (s: FollowupAutomationSettings) => void;
  onSave: () => void;
  onCreateTemplate: (t: { name: string; description: string; day_offsets: number[] }) => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEAD_TYPES: { key: LeadType; label: string }[] = [
  { key: 'buyer', label: 'Buyer' },
  { key: 'seller', label: 'Seller' },
  { key: 'investor', label: 'Investor' },
  { key: 'landlord', label: 'Landlord' },
  { key: 'tenant', label: 'Tenant' },
];

const APPROVAL_WINDOW_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0 hours — Must approve immediately' },
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours (recommended)' },
  { value: 24, label: '24 hours' },
  { value: -1, label: 'Always require manual approval' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i < 12 ? 'am' : 'pm';
  const display = i === 0 ? '12am' : i === 12 ? '12pm' : `${i > 12 ? i - 12 : i}${suffix}`;
  return { value: i, label: display };
});

function cadencePreview(template: string, customTemplates: CustomCadenceTemplate[]): string {
  const builtin = CADENCE_TEMPLATES[template as keyof typeof CADENCE_TEMPLATES];
  if (builtin) {
    const lastDay = builtin.dayOffsets[builtin.dayOffsets.length - 1];
    return `Sends ${builtin.dayOffsets.length} messages over ${lastDay} days`;
  }
  // Look up by id in custom templates
  const custom = customTemplates.find((t) => t.id === template);
  if (custom) {
    const lastDay = custom.day_offsets[custom.day_offsets.length - 1];
    return `Sends ${custom.day_offsets.length} messages over ${lastDay} days`;
  }
  return '';
}

// ─── Sub-component: Template Select ──────────────────────────────────────────

function TemplateSelect({
  value,
  customTemplates,
  onChange,
}: {
  value: string;
  customTemplates: CustomCadenceTemplate[];
  onChange: (v: string) => void;
}) {
  const selectClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <optgroup label="Built-in Templates">
        {Object.entries(CADENCE_TEMPLATES).map(([key, tpl]) => (
          <option key={key} value={key}>
            {tpl.name}
          </option>
        ))}
      </optgroup>
      {customTemplates.length > 0 && (
        <optgroup label="Your Custom Templates">
          {customTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// ─── Sub-component: Visual Cadence Editor ────────────────────────────────────

function CadenceEditor({
  offsets,
  onChange,
}: {
  offsets: number[];
  onChange: (next: number[]) => void;
}) {
  const updateOffset = (idx: number, value: number) => {
    const next = [...offsets];
    next[idx] = Math.max(1, Math.min(365, value));
    next.sort((a, b) => a - b);
    onChange(next);
  };

  const removeOffset = (idx: number) => {
    if (offsets.length <= 1) return; // keep at least one
    onChange(offsets.filter((_, i) => i !== idx));
  };

  const addOffset = () => {
    const last = offsets[offsets.length - 1] || 0;
    const next = [...offsets, last + 7].sort((a, b) => a - b);
    onChange(next);
  };

  const lastDay = offsets[offsets.length - 1] || 0;
  const totalTouches = offsets.length;

  return (
    <div className="space-y-3">
      {/* Day chips */}
      <div className="flex flex-wrap gap-2 items-center">
        {offsets.map((day, idx) => (
          <div
            key={idx}
            className="group flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1.5"
          >
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase">Day</span>
            <input
              type="number"
              min={1}
              max={365}
              value={day}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) updateOffset(idx, v);
              }}
              className="w-12 text-sm font-bold text-blue-700 dark:text-blue-300 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5"
            />
            {offsets.length > 1 && (
              <button
                onClick={() => removeOffset(idx)}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs ml-0.5 transition-opacity"
                title="Remove this touch"
              >
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addOffset}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 rounded-lg transition-colors"
        >
          <i className="fas fa-plus text-xs"></i>Add touch
        </button>
      </div>

      {/* Summary */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <i className="fas fa-info-circle mr-1"></i>
        {totalTouches} touch{totalTouches !== 1 ? 'es' : ''} over {lastDay} day{lastDay !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Sub-component: Save Custom Template Modal ──────────────────────────────

function SaveTemplateModal({
  initialOffsets,
  onClose,
  onSubmit,
  submitting,
}: {
  initialOffsets: number[];
  onClose: () => void;
  onSubmit: (t: { name: string; description: string; day_offsets: number[] }) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [offsets, setOffsets] = useState<number[]>(initialOffsets);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!name.trim()) { setLocalError('Name is required.'); return; }
    if (offsets.length === 0) { setLocalError('Add at least one touch.'); return; }
    await onSubmit({ name: name.trim(), description: description.trim(), day_offsets: offsets });
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            <i className="fas fa-save mr-2 text-blue-500"></i>Save as Custom Template
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {localError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {localError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hot Buyer Blitz" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Aggressive 5-touch in 2 weeks" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Touches</label>
          <CadenceEditor offsets={offsets} onChange={setOffsets} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium">
            {submitting ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AutomationTab({
  settings,
  customTemplates,
  loading,
  saving,
  error,
  success,
  hasChanges,
  onSettingsChange,
  onSave,
  onCreateTemplate,
}: AutomationTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [editorOffsets, setEditorOffsets] = useState<number[]>([]);

  // Get the current default template's day offsets to seed the editor
  const currentTemplateOffsets = (() => {
    const builtin = CADENCE_TEMPLATES[settings.followup_default_template as keyof typeof CADENCE_TEMPLATES];
    if (builtin) return builtin.dayOffsets;
    const custom = customTemplates.find((t) => t.id === settings.followup_default_template);
    return custom?.day_offsets || [1, 2, 4, 7, 10, 14, 21, 30];
  })();

  const handleCreateTemplate = async (t: {
    name: string;
    description: string;
    day_offsets: number[];
  }) => {
    setCreatingTemplate(true);
    try {
      await onCreateTemplate(t);
      setShowCreateModal(false);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const openCustomEditor = () => {
    setEditorOffsets(currentTemplateOffsets);
    setShowCreateModal(true);
  };

  const set = <K extends keyof FollowupAutomationSettings>(
    key: K,
    value: FollowupAutomationSettings[K]
  ) => onSettingsChange({ ...settings, [key]: value });

  const setLeadTypeTemplate = (leadType: LeadType, template: string) => {
    onSettingsChange({
      ...settings,
      followup_template_by_lead_type: {
        ...settings.followup_template_by_lead_type,
        [leadType]: template,
      },
    });
  };

  const cardClass =
    'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const selectClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

  if (loading) {
    return (
      <section className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </section>
    );
  }

  return (
    <>
      {showCreateModal && (
        <SaveTemplateModal
          initialOffsets={editorOffsets}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTemplate}
          submitting={creatingTemplate}
        />
      )}

      <section className="space-y-6 max-w-3xl">
        {/* Feedback banners */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* ── Section 1: Automation Mode ─────────────────────────────── */}
        <div className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <i className="fas fa-robot text-blue-500"></i> Automation Mode
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose how follow-ups are scheduled and sent.
          </p>

          <div className="space-y-3">
            {(
              [
                {
                  value: 'full_auto',
                  icon: 'fa-bolt',
                  title: 'Full Auto',
                  desc: 'Follow-ups send automatically. Best for high-volume agents.',
                },
                {
                  value: 'approval_required',
                  icon: 'fa-check-circle',
                  title: 'Approval Required',
                  desc: 'Review and approve each follow-up before it sends.',
                },
                {
                  value: 'manual',
                  icon: 'fa-hand-paper',
                  title: 'Manual Only',
                  desc: "I'll create each follow-up myself. No auto-creation after campaigns.",
                },
              ] as const
            ).map((opt) => {
              const active = settings.followup_automation_mode === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="automation_mode"
                    value={opt.value}
                    checked={active}
                    onChange={() => set('followup_automation_mode', opt.value)}
                    className="mt-1 accent-blue-600"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <i className={`fas ${opt.icon} text-blue-500`}></i>
                      {opt.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {opt.desc}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Approval Window (conditional) ───────────────── */}
        {settings.followup_automation_mode === 'approval_required' && (
          <div className={cardClass}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <i className="fas fa-clock text-amber-500"></i> Approval Window
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              How long you have to approve a follow-up before it auto-cancels.
            </p>
            <select
              value={settings.followup_approval_window_hours}
              onChange={(e) =>
                set('followup_approval_window_hours', parseInt(e.target.value, 10))
              }
              className={selectClass}
            >
              {APPROVAL_WINDOW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Section 3: Default Cadence Template ────────────────────── */}
        <div className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-purple-500"></i> Default Cadence Template
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Used when no lead-type-specific template is configured.
          </p>

          <div className="space-y-3">
            <TemplateSelect
              value={settings.followup_default_template}
              customTemplates={customTemplates}
              onChange={(v) => set('followup_default_template', v)}
            />

            {/* Visual cadence display */}
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Current Sequence
                </span>
                <button
                  onClick={openCustomEditor}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <i className="fas fa-edit mr-1"></i>Customize
                </button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {currentTemplateOffsets.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 rounded-lg px-3 py-2 min-w-[52px] text-center">
                      <div className="text-[9px] text-gray-500 dark:text-gray-400 uppercase">Day</div>
                      <div className="text-base font-bold text-purple-700 dark:text-purple-300">{day}</div>
                    </div>
                    {idx < currentTemplateOffsets.length - 1 && (
                      <span className="text-xs text-gray-400 mt-1">↓</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                <i className="fas fa-info-circle mr-1"></i>
                {currentTemplateOffsets.length} touches over {currentTemplateOffsets[currentTemplateOffsets.length - 1]} days. Click <strong>Customize</strong> to make your own version.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 4: Per Lead-Type Cadences ──────────────────────── */}
        <div className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <i className="fas fa-users text-green-500"></i> Cadence by Lead Type
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Fine-tune which cadence applies to each lead type.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LEAD_TYPES.map(({ key, label }) => {
              const current =
                settings.followup_template_by_lead_type[key] ||
                DEFAULT_TEMPLATE_BY_LEAD_TYPE[key];
              const preview = cadencePreview(current, customTemplates);
              return (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <TemplateSelect
                    value={current}
                    customTemplates={customTemplates}
                    onChange={(v) => setLeadTypeTemplate(key, v)}
                  />
                  {preview && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{preview}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 5: Quiet Hours / TCPA ──────────────────────────── */}
        <div className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <i className="fas fa-moon text-indigo-500"></i> Quiet Hours &amp; TCPA Compliance
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Restrict sending to TCPA-safe windows.
          </p>

          {/* Send window */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Start Time</label>
              <select
                value={settings.followup_quiet_hours_start}
                onChange={(e) =>
                  set('followup_quiet_hours_start', parseInt(e.target.value, 10))
                }
                className={selectClass}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>End Time</label>
              <select
                value={settings.followup_quiet_hours_end}
                onChange={(e) =>
                  set('followup_quiet_hours_end', parseInt(e.target.value, 10))
                }
                className={selectClass}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  TCPA Compliance Enabled
                  <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-normal">
                    Recommended
                  </span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Enforces the send window above. State-specific rules (FL, OK) apply automatically.
                </div>
              </div>
              <ToggleSwitch
                checked={settings.followup_tcpa_enabled}
                onChange={(v) => set('followup_tcpa_enabled', v)}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Skip Weekends
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Reschedules Saturday/Sunday sends to Monday morning.
                </div>
              </div>
              <ToggleSwitch
                checked={settings.followup_skip_weekends}
                onChange={(v) => set('followup_skip_weekends', v)}
              />
            </label>
          </div>

          {/* Info note */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <i className="fas fa-info-circle mr-1"></i>
            We auto-detect lead timezone from area code. State-specific rules (FL, OK) apply tighter windows automatically.
          </div>
        </div>

        {/* ── Section 6: Sequence Length ─────────────────────────────── */}
        <div className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <i className="fas fa-layer-group text-orange-500"></i> Sequence Length
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Cap the number of automated touches per lead.
          </p>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className={labelClass}>Max touches per sequence</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.followup_max_touches}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 20) {
                    set('followup_max_touches', v);
                  }
                }}
                className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="flex-1 text-sm text-gray-500 dark:text-gray-400 pt-6">
              Range: 1–20
            </div>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
            <i className="fas fa-lightbulb mr-1"></i>
            Research shows 95% of conversions happen after touch 6.
          </p>
        </div>

        {/* ── Save Button ────────────────────────────────────────────── */}
        <div className="flex justify-end pb-4">
          <button
            onClick={onSave}
            disabled={saving || !hasChanges}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>Saving...
              </>
            ) : (
              'Save Automation Settings'
            )}
          </button>
        </div>
      </section>
    </>
  );
}

// ─── Reusable Toggle Switch ───────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-blue-600"></div>
    </label>
  );
}
