'use client';

import type { AiConfig } from './types';

type AiScriptTabProps = {
  aiConfig: AiConfig;
  aiConfigLoading: boolean;
  aiConfigSaving: boolean;
  aiConfigError: string | null;
  aiConfigSuccess: string | null;
  onConfigChange: (config: AiConfig) => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (index: number, value: string) => void;
  onRemoveQuestion: (index: number) => void;
  onSave: () => void;
};

export default function AiScriptTab({
  aiConfig,
  aiConfigLoading,
  aiConfigSaving,
  aiConfigError,
  aiConfigSuccess,
  onConfigChange,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  onSave,
}: AiScriptTabProps) {
  if (aiConfigLoading) {
    return (
      <section className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 max-w-3xl">
      {aiConfigError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {aiConfigError}
        </div>
      )}
      {aiConfigSuccess && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
          {aiConfigSuccess}
        </div>
      )}

      {/* Active Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Personality</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the AI bot communicates with your leads</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiConfig.active}
              onChange={(e) => onConfigChange({ ...aiConfig, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Tone & Style */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Tone & Style</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tone</label>
            <select
              value={aiConfig.tone}
              onChange={(e) => onConfigChange({ ...aiConfig, tone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
            <select
              value={aiConfig.language}
              onChange={(e) => onConfigChange({ ...aiConfig, language: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="arabic">Arabic</option>
              <option value="french">French</option>
              <option value="portuguese">Portuguese</option>
              <option value="mandarin">Mandarin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Closing Style</label>
            <select
              value={aiConfig.closing_style}
              onChange={(e) => onConfigChange({ ...aiConfig, closing_style: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="direct">Direct</option>
              <option value="soft">Soft</option>
              <option value="consultative">Consultative</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Property Focus</label>
            <select
              value={aiConfig.property_focus}
              onChange={(e) => onConfigChange({ ...aiConfig, property_focus: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="luxury">Luxury</option>
              <option value="industrial">Industrial</option>
            </select>
          </div>
        </div>
      </div>

      {/* Custom Messages */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Custom Messages</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Introduction Template</label>
            <textarea
              value={aiConfig.introduction_template || ''}
              onChange={(e) => onConfigChange({ ...aiConfig, introduction_template: e.target.value || null })}
              placeholder="e.g., Hey! This is [name] from [company]. I noticed your property at..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">How the AI should greet new leads for the first time</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Escalation Message</label>
            <textarea
              value={aiConfig.escalation_message || ''}
              onChange={(e) => onConfigChange({ ...aiConfig, escalation_message: e.target.value || null })}
              placeholder="e.g., I want to make sure you get the best help possible. Let me connect you with..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sent when the AI needs to escalate to you directly</p>
          </div>
        </div>
      </div>

      {/* Qualification Questions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Custom Qualification Questions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Additional questions the AI will weave into conversations</p>
          </div>
          <button
            onClick={onAddQuestion}
            disabled={aiConfig.qualification_questions.length >= 10}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            + Add Question
          </button>
        </div>
        <div className="space-y-2">
          {aiConfig.qualification_questions.map((q, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => onUpdateQuestion(i, e.target.value)}
                placeholder={`Question ${i + 1}`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => onRemoveQuestion(i)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <i className="fas fa-trash text-sm"></i>
              </button>
            </div>
          ))}
          {aiConfig.qualification_questions.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No custom questions yet. Click &quot;Add Question&quot; to start.</p>
          )}
        </div>
      </div>

      {/* Free-form Instructions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Custom Instructions</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Free-form instructions for the AI. Be specific about what you want.</p>
        <textarea
          value={aiConfig.custom_instructions || ''}
          onChange={(e) => onConfigChange({ ...aiConfig, custom_instructions: e.target.value || null })}
          placeholder="e.g., Always mention our free home valuation service. Never discuss commission rates. If they mention foreclosure, handle with extra sensitivity..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={aiConfigSaving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium"
        >
          {aiConfigSaving ? 'Saving...' : 'Save AI Personality'}
        </button>
      </div>
    </section>
  );
}
