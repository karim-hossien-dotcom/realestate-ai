'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

type FUBStatus = {
  connected: boolean;
  status?: string;
  lastSyncAt?: string;
  errorMessage?: string;
  leadsFromCrm?: number;
};

type SettingsSection = 'profile' | 'integrations' | 'messaging' | 'email' | 'team' | 'auto-reply' | 'billing';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  // FUB Integration state
  const [fubStatus, setFubStatus] = useState<FUBStatus | null>(null);
  const [fubApiKey, setFubApiKey] = useState('');
  const [fubConnecting, setFubConnecting] = useState(false);
  const [fubSyncing, setFubSyncing] = useState(false);
  const [fubError, setFubError] = useState<string | null>(null);
  const [fubSuccess, setFubSuccess] = useState<string | null>(null);

  // Fetch profile and FUB status on mount
  useEffect(() => {
    fetchProfile();
    fetchFubStatus();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/settings/profile');
      const data = await response.json();

      if (data.ok && data.profile) {
        setProfile(data.profile);
        setFullName(data.profile.full_name || '');
        setCompany(data.profile.company || '');
        setPhone(data.profile.phone || '');
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          company,
          phone,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setProfile(data.profile);
        setSuccess('Profile saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    fullName !== (profile?.full_name || '') ||
    company !== (profile?.company || '') ||
    phone !== (profile?.phone || '');

  // Fetch FUB connection status
  const fetchFubStatus = async () => {
    try {
      const response = await fetch('/api/integrations/fub/status');
      const data = await response.json();
      if (data.ok) {
        setFubStatus(data);
      }
    } catch (err) {
      console.error('Fetch FUB status error:', err);
    }
  };

  // Connect to FUB
  const handleFubConnect = async () => {
    if (!fubApiKey.trim()) {
      setFubError('Please enter your API key');
      return;
    }

    setFubConnecting(true);
    setFubError(null);
    setFubSuccess(null);

    try {
      const response = await fetch('/api/integrations/fub/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: fubApiKey }),
      });

      const data = await response.json();

      if (data.ok) {
        setFubSuccess('Connected successfully!');
        setFubApiKey('');
        fetchFubStatus();
        setTimeout(() => setFubSuccess(null), 3000);
      } else {
        setFubError(data.error || 'Failed to connect');
      }
    } catch (err) {
      console.error('FUB connect error:', err);
      setFubError('Failed to connect');
    } finally {
      setFubConnecting(false);
    }
  };

  // Disconnect from FUB
  const handleFubDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Follow Up Boss?')) return;

    setFubConnecting(true);
    setFubError(null);

    try {
      const response = await fetch('/api/integrations/fub/connect', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        setFubStatus({ connected: false });
        setFubSuccess('Disconnected successfully');
        setTimeout(() => setFubSuccess(null), 3000);
      } else {
        setFubError(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      console.error('FUB disconnect error:', err);
      setFubError('Failed to disconnect');
    } finally {
      setFubConnecting(false);
    }
  };

  // Sync leads from FUB
  const handleFubSync = async () => {
    setFubSyncing(true);
    setFubError(null);
    setFubSuccess(null);

    try {
      const response = await fetch('/api/integrations/fub/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        setFubSuccess(data.message);
        fetchFubStatus();
        setTimeout(() => setFubSuccess(null), 5000);
      } else {
        setFubError(data.error || 'Failed to sync');
      }
    } catch (err) {
      console.error('FUB sync error:', err);
      setFubError('Failed to sync');
    } finally {
      setFubSyncing(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const settingsSections = [
    { id: 'profile' as const, label: 'Profile & Account', icon: 'fa-user' },
    { id: 'integrations' as const, label: 'Integrations', icon: 'fa-plug' },
    { id: 'messaging' as const, label: 'Messaging Provider', icon: 'fa-sms', comingSoon: true },
    { id: 'email' as const, label: 'Email Settings', icon: 'fa-envelope', comingSoon: true },
    { id: 'team' as const, label: 'Team Management', icon: 'fa-users-cog', comingSoon: true },
    { id: 'auto-reply' as const, label: 'Auto-Reply', icon: 'fa-robot', comingSoon: true },
    { id: 'billing' as const, label: 'Billing & Plans', icon: 'fa-credit-card', comingSoon: true },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-home text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RealEstate AI</h1>
              <p className="text-sm text-gray-500">Agent Assistant</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 px-4">
          <ul className="space-y-2">
            <li>
              <a href="/prototype/dashboard" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-chart-line w-5 mr-3"></i>
                Dashboard
              </a>
            </li>
            <li>
              <a href="/prototype/leads" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-users w-5 mr-3"></i>
                Leads
              </a>
            </li>
            <li>
              <a href="/prototype/campaigns" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-bullhorn w-5 mr-3"></i>
                Campaigns
              </a>
            </li>
            <li>
              <a href="/prototype/follow-ups" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-clock w-5 mr-3"></i>
                Follow-Ups
              </a>
            </li>
            <li>
              <a href="/prototype/conversations" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-comments w-5 mr-3"></i>
                Conversations
              </a>
            </li>
            <li>
              <a href="/prototype/calendar" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-calendar w-5 mr-3"></i>
                Calendar
              </a>
            </li>
            <li>
              <a href="/prototype/logs" className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                <i className="fas fa-file-alt w-5 mr-3"></i>
                Logs
              </a>
            </li>
            <li>
              <a href="/prototype/settings" className="flex items-center px-4 py-3 text-blue-600 bg-blue-50 rounded-lg">
                <i className="fas fa-cog w-5 mr-3"></i>
                Settings
              </a>
            </li>
          </ul>
        </nav>

        {/* Sign out button */}
        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-200 bg-white">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            <i className="fas fa-sign-out-alt w-5 mr-3"></i>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <p className="text-gray-500">Manage your profile, integrations, and platform configuration</p>
            </div>
            {/* Show agent profile info */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                {fullName ? fullName.charAt(0).toUpperCase() : profile?.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{fullName || profile?.email || 'Loading...'}</p>
                <p className="text-xs text-gray-500">{company || 'Real Estate Agent'}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Settings nav */}
          <nav className="w-64 bg-white border-r border-gray-200 p-6 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Settings</h3>
            <ul className="space-y-2">
              {settingsSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <i className={`fas ${section.icon} w-5 mr-3`}></i>
                    {section.label}
                    {section.comingSoon && (
                      <span className="ml-auto text-xs text-gray-400">Soon</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Profile Section */}
                {activeSection === 'profile' && (
                  <section className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving || !hasChanges}
                          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                            hasChanges && !saving
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>

                      {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                          {error}
                        </div>
                      )}

                      {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                          {success}
                        </div>
                      )}

                      <div className="flex items-center space-x-6 mb-6">
                        <div className="relative">
                          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                            {fullName ? fullName.charAt(0).toUpperCase() : profile?.email?.charAt(0).toUpperCase() || '?'}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{fullName || 'Your Name'}</h4>
                          <p className="text-gray-500">{profile?.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                          <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                          <input
                            type="text"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="Your real estate company"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Account Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Member since</span>
                          <span className="text-gray-900">
                            {profile?.created_at
                              ? new Date(profile.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Last updated</span>
                          <span className="text-gray-900">
                            {profile?.updated_at
                              ? new Date(profile.updated_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Integrations Section */}
                {activeSection === 'integrations' && (
                  <section className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">CRM Integrations</h3>
                      <p className="text-gray-500 mb-6">Connect your CRM to sync leads automatically.</p>

                      {fubError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                          {fubError}
                        </div>
                      )}

                      {fubSuccess && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                          {fubSuccess}
                        </div>
                      )}

                      {/* Follow Up Boss */}
                      <div className="border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                              <i className="fas fa-user-tie text-orange-600 text-xl"></i>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">Follow Up Boss</h4>
                              <p className="text-sm text-gray-500">Sync leads and activities</p>
                            </div>
                          </div>
                          {fubStatus?.connected ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center">
                              <i className="fas fa-check-circle mr-1"></i>
                              Connected
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                              Not Connected
                            </span>
                          )}
                        </div>

                        {fubStatus?.connected ? (
                          <div className="space-y-4">
                            {/* Connection Stats */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Leads from CRM:</span>
                                <span className="ml-2 font-medium">{fubStatus.leadsFromCrm || 0}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Last sync:</span>
                                <span className="ml-2 font-medium">
                                  {fubStatus.lastSyncAt
                                    ? new Date(fubStatus.lastSyncAt).toLocaleString()
                                    : 'Never'}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-3">
                              <button
                                onClick={handleFubSync}
                                disabled={fubSyncing}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                              >
                                {fubSyncing ? (
                                  <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    Syncing...
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-sync mr-2"></i>
                                    Sync Now
                                  </>
                                )}
                              </button>
                              <button
                                onClick={handleFubDisconnect}
                                disabled={fubConnecting}
                                className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                              >
                                Disconnect
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key
                              </label>
                              <input
                                type="password"
                                value={fubApiKey}
                                onChange={(e) => setFubApiKey(e.target.value)}
                                placeholder="Enter your Follow Up Boss API key"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Find your API key in Follow Up Boss under Admin &gt; API
                              </p>
                            </div>
                            <button
                              onClick={handleFubConnect}
                              disabled={fubConnecting || !fubApiKey.trim()}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              {fubConnecting ? (
                                <>
                                  <i className="fas fa-spinner fa-spin mr-2"></i>
                                  Connecting...
                                </>
                              ) : (
                                'Connect'
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* HubSpot */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                              <i className="fas fa-database text-orange-500 text-xl"></i>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">HubSpot</h4>
                              <p className="text-sm text-gray-500">Enterprise CRM integration</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                            Coming Soon
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Coming Soon Sections */}
                {['messaging', 'email', 'team', 'auto-reply', 'billing'].includes(activeSection) && (
                  <section className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-tools text-gray-400 text-2xl"></i>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
                      <p className="text-gray-500">
                        This feature is under development and will be available soon.
                      </p>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
