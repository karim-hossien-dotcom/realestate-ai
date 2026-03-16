'use client';

import type { FUBStatus } from './types';

type CrmTabProps = {
  fubStatus: FUBStatus | null;
  fubApiKey: string;
  fubConnecting: boolean;
  fubSyncing: boolean;
  fubError: string | null;
  fubSuccess: string | null;
  onApiKeyChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
};

export default function CrmTab({
  fubStatus,
  fubApiKey,
  fubConnecting,
  fubSyncing,
  fubError,
  fubSuccess,
  onApiKeyChange,
  onConnect,
  onDisconnect,
  onSync,
}: CrmTabProps) {
  return (
    <section className="space-y-6 max-w-3xl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">CRM Integrations</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Connect your CRM to sync leads automatically.</p>

        {fubError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {fubError}
          </div>
        )}
        {fubSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
            {fubSuccess}
          </div>
        )}

        {/* Follow Up Boss */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <i className="fas fa-user-tie text-orange-600 dark:text-orange-400 text-xl"></i>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Follow Up Boss</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sync leads and activities</p>
              </div>
            </div>
            {fubStatus?.connected ? (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm flex items-center">
                <i className="fas fa-check-circle mr-1"></i>
                Connected
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-sm">
                Not Connected
              </span>
            )}
          </div>

          {fubStatus?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Leads from CRM:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{fubStatus.leadsFromCrm || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last sync:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {fubStatus.lastSyncAt ? new Date(fubStatus.lastSyncAt).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onSync}
                  disabled={fubSyncing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 text-center"
                >
                  {fubSyncing ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Syncing...</>
                  ) : (
                    <><i className="fas fa-sync mr-2"></i>Sync Now</>
                  )}
                </button>
                <button
                  onClick={onDisconnect}
                  disabled={fubConnecting}
                  className="px-4 py-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                <input
                  type="password"
                  value={fubApiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="Enter your Follow Up Boss API key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Find your API key in Follow Up Boss under Admin &gt; API
                </p>
              </div>
              <button
                onClick={onConnect}
                disabled={fubConnecting || !fubApiKey.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {fubConnecting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Connecting...</> : 'Connect'}
              </button>
            </div>
          )}
        </div>

        {/* HubSpot */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <i className="fas fa-database text-orange-500 dark:text-orange-400 text-xl"></i>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">HubSpot</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enterprise CRM integration</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-sm">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
