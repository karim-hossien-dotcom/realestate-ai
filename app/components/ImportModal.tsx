'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ColumnMapping } from '@/app/lib/csv-mapper';
import { MAPPABLE_FIELDS } from '@/app/lib/csv-mapper';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'results';

type PreviewResponse = {
  ok: boolean;
  error?: string;
  headers: string[];
  mapping: ColumnMapping[];
  preview: Record<string, string>[];
  totalRows: number;
  previewRows: number;
};

type ImportStats = {
  total: number;
  inserted: number;
  duplicates: number;
  errors: number;
};

type ImportResult = {
  ok: boolean;
  message?: string;
  stats?: ImportStats;
  errors?: string[];
  error?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
};

export default function ImportModal({ isOpen, onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview data
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [userMapping, setUserMapping] = useState<Record<string, string>>({});

  // Import results
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setStep('upload');
    setFile(null);
    setLoading(false);
    setError(null);
    setPreviewData(null);
    setUserMapping({});
    setImportResult(null);
    onClose();
  }, [onClose]);

  // ---- Step 1: File Upload ----

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/leads/import/preview', { method: 'POST', body: formData });
      const data: PreviewResponse = await res.json();

      if (!data.ok) {
        setError(data.error || 'Preview failed');
        setLoading(false);
        return;
      }

      setPreviewData(data);

      // Build initial user mapping from auto-detected mappings
      const initial: Record<string, string> = {};
      for (const col of data.mapping) {
        initial[col.csvHeader] = col.mappedField || '(skip)';
      }
      setUserMapping(initial);
      setStep('mapping');
    } catch {
      setError('Failed to parse CSV file.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
  };

  // ---- Step 2: Column Mapping ----

  const handleMappingChange = (csvHeader: string, field: string) => {
    setUserMapping(prev => ({ ...prev, [csvHeader]: field }));
  };

  const handleConfirmMapping = () => {
    setStep('preview');
  };

  // ---- Step 3: Preview & Import ----

  const getPreviewLeads = useCallback(() => {
    if (!previewData) return [];
    return previewData.preview.map(row => {
      const lead: Record<string, string> = {};
      for (const [csvHeader, field] of Object.entries(userMapping)) {
        if (field === '(skip)') continue;
        const value = row[csvHeader] || '';
        if (!value) continue;

        if (field === 'first_name') {
          lead._firstName = value;
        } else if (field === 'last_name') {
          lead._lastName = value;
        } else if (field.startsWith('_address_')) {
          lead[field] = value;
        } else {
          lead[field] = value;
        }
      }

      // Merge first + last name
      if (!lead.owner_name && (lead._firstName || lead._lastName)) {
        lead.owner_name = [lead._firstName, lead._lastName].filter(Boolean).join(' ');
      }
      delete lead._firstName;
      delete lead._lastName;

      // Merge address parts
      if (!lead.property_address) {
        const parts = [lead._address_street, lead._address_city, lead._address_state, lead._address_zip]
          .filter(Boolean);
        if (parts.length > 0) {
          lead.property_address = parts.join(', ');
        }
      }
      delete lead._address_street;
      delete lead._address_city;
      delete lead._address_state;
      delete lead._address_zip;

      return lead;
    });
  }, [previewData, userMapping]);

  const getWarnings = useCallback(() => {
    const previewed = getPreviewLeads();
    const warnings: string[] = [];
    const noPhone = previewed.filter(l => !l.phone).length;
    const noName = previewed.filter(l => !l.owner_name).length;
    if (noPhone > 0) warnings.push(`${noPhone} of ${previewed.length} preview rows have no phone`);
    if (noName > 0) warnings.push(`${noName} of ${previewed.length} preview rows have no name`);
    return warnings;
  }, [getPreviewLeads]);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      // Build clean mapping (exclude skipped columns)
      const cleanMapping: Record<string, string> = {};
      for (const [csvHeader, field] of Object.entries(userMapping)) {
        if (field !== '(skip)') {
          cleanMapping[csvHeader] = field;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(cleanMapping));

      const res = await fetch('/api/leads/import', { method: 'POST', body: formData });
      const data: ImportResult = await res.json();

      if (!res.ok && (data.error === 'no_subscription' || data.error === 'limit_exceeded')) {
        setError(data.message || 'Plan limit reached. Please upgrade your subscription.');
        return;
      }

      setImportResult(data);
      setStep('results');

      if (data.ok) {
        onImportComplete();
      }
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Confidence badge ----

  const confidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">Auto</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">Likely</span>;
      case 'low':
        return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">Guess</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Manual</span>;
    }
  };

  if (!isOpen) return null;

  // Check for first_name + last_name combo
  const hasNameMerge = Object.values(userMapping).includes('first_name') && Object.values(userMapping).includes('last_name');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import Leads</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {step === 'upload' && 'Upload a CSV file to get started'}
              {step === 'mapping' && 'Map your CSV columns to lead fields'}
              {step === 'preview' && 'Review before importing'}
              {step === 'results' && 'Import complete'}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
          {(['upload', 'mapping', 'preview', 'results'] as ImportStep[]).map((s, i) => {
            const labels = ['Upload', 'Map Columns', 'Preview', 'Results'];
            const isActive = s === step;
            const isPast = ['upload', 'mapping', 'preview', 'results'].indexOf(step) > i;
            return (
              <div key={s} className="flex items-center">
                {i > 0 && <div className={`w-8 h-px mx-1 ${isPast ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`} />}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                  isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                  isPast ? 'text-blue-600 dark:text-blue-400' :
                  'text-gray-400 dark:text-gray-500'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? 'bg-blue-600 text-white' :
                    isPast ? 'bg-blue-600 text-white' :
                    'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {isPast ? <i className="fas fa-check text-[9px]"></i> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{labels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleInputChange} className="hidden" />
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                    <p className="text-sm text-[var(--text-secondary)]">Analyzing CSV columns...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <i className="fas fa-file-csv text-2xl text-blue-500"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Drop your CSV file here or click to browse
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Supports MLS, Follow Up Boss, Zillow, and custom CSV exports
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && previewData && (
            <div className="space-y-4">
              {hasNameMerge && (
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <i className="fas fa-info-circle mr-1.5"></i>
                  First Name + Last Name will be combined into the Name field.
                </div>
              )}

              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-elevated)]">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">CSV Column</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Map To</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-secondary)] uppercase hidden sm:table-cell">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.mapping.map((col) => {
                      const currentField = userMapping[col.csvHeader] || '(skip)';
                      return (
                        <tr key={col.csvHeader} className="border-t border-[var(--border)] hover:bg-[var(--surface-elevated)]/50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">{col.csvHeader}</span>
                              {confidenceBadge(col.confidence)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={currentField}
                              onChange={(e) => handleMappingChange(col.csvHeader, e.target.value)}
                              className={`w-full px-2 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500 ${
                                currentField === '(skip)'
                                  ? 'border-gray-300 dark:border-gray-600 text-gray-400'
                                  : 'border-blue-300 dark:border-blue-500 text-[var(--text-primary)]'
                              }`}
                            >
                              {MAPPABLE_FIELDS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <div className="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">
                              {col.sampleValues.filter(Boolean).slice(0, 3).join(', ') || '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && previewData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Ready to import <span className="text-blue-600 dark:text-blue-400 font-bold">{previewData.totalRows}</span> leads
                </p>
              </div>

              {getWarnings().map((w, i) => (
                <div key={i} className="p-2.5 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg text-xs text-yellow-700 dark:text-yellow-300">
                  <i className="fas fa-exclamation-triangle mr-1.5"></i>{w}
                </div>
              ))}

              <div className="border border-[var(--border)] rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-elevated)]">
                    <tr>
                      {['Name', 'Phone', 'Email', 'Address', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-secondary)] uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getPreviewLeads().map((lead, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2 text-[var(--text-primary)] whitespace-nowrap">{lead.owner_name || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] whitespace-nowrap">{lead.phone || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] whitespace-nowrap">{lead.email || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] truncate max-w-[200px]">{lead.property_address || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-2 text-[var(--text-primary)] whitespace-nowrap">{lead.status || 'new'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Showing {previewData.previewRows} of {previewData.totalRows} rows</p>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && importResult && (
            <div className="space-y-4">
              {importResult.ok ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check text-2xl text-green-600 dark:text-green-400"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Import Complete</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{importResult.message}</p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-times text-2xl text-red-600 dark:text-red-400"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Import Failed</h3>
                  <p className="text-sm text-red-600 dark:text-red-400">{importResult.error}</p>
                </div>
              )}

              {importResult.stats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[var(--surface-elevated)] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult.stats.inserted}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Inserted</p>
                  </div>
                  <div className="bg-[var(--surface-elevated)] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{importResult.stats.duplicates}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Duplicates</p>
                  </div>
                  <div className="bg-[var(--surface-elevated)] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult.stats.errors}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Errors</p>
                  </div>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-1">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="p-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded text-xs text-yellow-700 dark:text-yellow-300">
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => { setStep('upload'); setFile(null); setPreviewData(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <i className="fas fa-arrow-left mr-1.5"></i>Back
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <i className="fas fa-arrow-left mr-1.5"></i>Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'results' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            {step === 'mapping' && (
              <button
                onClick={handleConfirmMapping}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next: Preview
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Importing...</>
                ) : (
                  <><i className="fas fa-file-import mr-2"></i>Import {previewData?.totalRows} Leads</>
                )}
              </button>
            )}
            {step === 'results' && (
              <button
                onClick={handleClose}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
