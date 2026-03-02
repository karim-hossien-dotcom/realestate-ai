'use client';

import { useState, useEffect } from 'react';

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

const settingsSections = [
  { id: 'profile' as const, label: 'Profile & Account', icon: 'fa-user', shortLabel: 'Profile' },
  { id: 'integrations' as const, label: 'Integrations', icon: 'fa-plug', shortLabel: 'CRM' },
  { id: 'messaging' as const, label: 'Messaging Provider', icon: 'fa-sms', comingSoon: true, shortLabel: 'Messaging' },
  { id: 'email' as const, label: 'Email Settings', icon: 'fa-envelope', comingSoon: true, shortLabel: 'Email' },
  { id: 'team' as const, label: 'Team Management', icon: 'fa-users-cog', comingSoon: true, shortLabel: 'Team' },
  { id: 'auto-reply' as const, label: 'Auto-Reply', icon: 'fa-robot', comingSoon: true, shortLabel: 'Auto-Reply' },
  { id: 'billing' as const, label: 'Billing & Plans', icon: 'fa-credit-card', shortLabel: 'Billing' },
];

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

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingData, setBillingData] = useState<{
    subscription: {
      status: string;
      plan: string;
      planSlug: string | null;
      currentPeriodEnd: string;
      trialEnd: string | null;
      cancelAtPeriodEnd: boolean;
    } | null;
    usage: {
      sms: number;
      email: number;
      whatsapp: number;
      leads: number;
      includedSms: number;
      includedLeads: number;
    };
  } | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchFubStatus();
  }, []);

  useEffect(() => {
    if (activeSection === 'billing') {
      fetchBillingData();
    }
  }, [activeSection]);

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
    } catch {
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
        body: JSON.stringify({ full_name: fullName, company, phone }),
      });
      const data = await response.json();
      if (data.ok) {
        setProfile(data.profile);
        setSuccess('Profile saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save profile');
      }
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    fullName !== (profile?.full_name || '') ||
    company !== (profile?.company || '') ||
    phone !== (profile?.phone || '');

  const fetchFubStatus = async () => {
    try {
      const response = await fetch('/api/integrations/fub/status');
      const data = await response.json();
      if (data.ok) setFubStatus(data);
    } catch { /* ignore */ }
  };

  const handleFubConnect = async () => {
    if (!fubApiKey.trim()) { setFubError('Please enter your API key'); return; }
    setFubConnecting(true); setFubError(null); setFubSuccess(null);
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
    } catch { setFubError('Failed to connect'); }
    finally { setFubConnecting(false); }
  };

  const handleFubDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Follow Up Boss?')) return;
    setFubConnecting(true); setFubError(null);
    try {
      const response = await fetch('/api/integrations/fub/connect', { method: 'DELETE' });
      const data = await response.json();
      if (data.ok) {
        setFubStatus({ connected: false });
        setFubSuccess('Disconnected successfully');
        setTimeout(() => setFubSuccess(null), 3000);
      } else { setFubError(data.error || 'Failed to disconnect'); }
    } catch { setFubError('Failed to disconnect'); }
    finally { setFubConnecting(false); }
  };

  const handleFubSync = async () => {
    setFubSyncing(true); setFubError(null); setFubSuccess(null);
    try {
      const response = await fetch('/api/integrations/fub/sync', { method: 'POST' });
      const data = await response.json();
      if (data.ok) {
        setFubSuccess(data.message);
        fetchFubStatus();
        setTimeout(() => setFubSuccess(null), 5000);
      } else { setFubError(data.error || 'Failed to sync'); }
    } catch { setFubError('Failed to sync'); }
    finally { setFubSyncing(false); }
  };

  const fetchBillingData = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const response = await fetch('/api/stripe/usage');
      const data = await response.json();
      if (data.ok) {
        setBillingData(data);
      } else {
        setBillingError(data.error || 'Failed to load billing data');
      }
    } catch {
      setBillingError('Failed to load billing data');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    setBillingError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await response.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setBillingError(data.error || 'Failed to start checkout');
      }
    } catch {
      setBillingError('Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setBillingError(null);
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await response.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
      } else {
        setBillingError(data.error || 'Failed to open billing portal');
      }
    } catch {
      setBillingError('Failed to open billing portal');
    }
  };

  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      price: '$29',
      period: '/mo',
      features: ['Up to 200 leads', '500 SMS/month', 'WhatsApp + Email + SMS', 'AI message generation', 'Lead scoring', 'Basic analytics'],
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '',
    },
    {
      slug: 'pro',
      name: 'Pro',
      price: '$59',
      period: '/mo',
      popular: true,
      features: ['Up to 1,000 leads', '2,000 SMS/month', 'Everything in Starter', 'Follow-up automation', 'CRM integration', 'Advanced analytics', 'Priority support'],
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
    },
    {
      slug: 'agency',
      name: 'Agency',
      price: '$149',
      period: '/mo',
      features: ['Unlimited leads', '10,000 SMS/month', 'Everything in Pro', 'Team management', 'White-label reports', 'Dedicated support', 'Custom integrations'],
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID || '',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your profile, integrations, and platform configuration</p>
      </div>

      {/* Horizontal Tab Bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 gap-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        {settingsSections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSection === section.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <i className={`fas ${section.icon} text-xs`}></i>
            <span className="hidden sm:inline">{section.label}</span>
            <span className="sm:hidden">{section.shortLabel}</span>
            {section.comingSoon && (
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Soon</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Profile Section */}
          {activeSection === 'profile' && (
            <section className="space-y-6 max-w-3xl">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profile Information</h3>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving || !hasChanges}
                    className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                      hasChanges && !saving
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                    {success}
                  </div>
                )}

                <div className="flex items-center space-x-6 mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-semibold flex-shrink-0">
                    {fullName ? fullName.charAt(0).toUpperCase() : profile?.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">{fullName || 'Your Name'}</h4>
                    <p className="text-gray-500 dark:text-gray-400">{profile?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Your real estate company"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Account Information</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Member since</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Last updated</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {profile?.updated_at
                        ? new Date(profile.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Integrations Section */}
          {activeSection === 'integrations' && (
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
                          onClick={handleFubSync}
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
                          onClick={handleFubDisconnect}
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
                          onChange={(e) => setFubApiKey(e.target.value)}
                          placeholder="Enter your Follow Up Boss API key"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Find your API key in Follow Up Boss under Admin &gt; API
                        </p>
                      </div>
                      <button
                        onClick={handleFubConnect}
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
          )}

          {/* Billing Section */}
          {activeSection === 'billing' && (
            <section className="space-y-6 max-w-5xl">
              {billingError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {billingError}
                </div>
              )}

              {billingLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Current Subscription Status */}
                  {billingData?.subscription ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Current Plan</h3>
                        <button
                          onClick={handleManageBilling}
                          className="text-sm px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <i className="fas fa-external-link-alt mr-2"></i>
                          Manage Billing
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Plan</span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{billingData.subscription.plan}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                          <p className="text-lg font-semibold">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                              billingData.subscription.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              billingData.subscription.status === 'trialing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            }`}>
                              {billingData.subscription.status === 'trialing' ? 'Free Trial' : billingData.subscription.status}
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {billingData.subscription.status === 'trialing' ? 'Trial ends' : 'Renews'}
                          </span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {new Date(billingData.subscription.trialEnd || billingData.subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {billingData.subscription.cancelAtPeriodEnd && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
                          <i className="fas fa-exclamation-triangle mr-2"></i>
                          Your subscription will be cancelled at the end of the current billing period.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                          <i className="fas fa-gift text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-blue-900 dark:text-blue-300">Start your 14-day free trial</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-400">Choose a plan below to get started. No charge during trial.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Usage Stats */}
                  {billingData?.subscription && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Usage This Period</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* SMS Usage */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">SMS Sent</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {billingData.usage.sms}{billingData.usage.includedSms > 0 ? `/${billingData.usage.includedSms}` : ''}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                billingData.usage.includedSms > 0 && billingData.usage.sms / billingData.usage.includedSms > 0.9
                                  ? 'bg-red-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(100, billingData.usage.includedSms > 0 ? (billingData.usage.sms / billingData.usage.includedSms) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>

                        {/* Email Usage */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Emails</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{billingData.usage.email}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">Unlimited</span>
                        </div>

                        {/* WhatsApp Usage */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">WhatsApp</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{billingData.usage.whatsapp}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">Pay per use</span>
                        </div>

                        {/* Leads */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Leads</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {billingData.usage.leads}{billingData.usage.includedLeads > 0 ? `/${billingData.usage.includedLeads}` : ''}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                billingData.usage.includedLeads > 0 && billingData.usage.leads / billingData.usage.includedLeads > 0.9
                                  ? 'bg-red-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${Math.min(100, billingData.usage.includedLeads > 0 ? (billingData.usage.leads / billingData.usage.includedLeads) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plan Cards */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      {billingData?.subscription ? 'Change Plan' : 'Choose a Plan'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {plans.map((plan) => {
                        const isCurrentPlan = billingData?.subscription?.planSlug === plan.slug;
                        return (
                          <div
                            key={plan.slug}
                            className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 p-6 transition-all ${
                              plan.popular
                                ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                                : isCurrentPlan
                                ? 'border-green-500 dark:border-green-400'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            {plan.popular && !isCurrentPlan && (
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                                Most Popular
                              </span>
                            )}
                            {isCurrentPlan && (
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                                Current Plan
                              </span>
                            )}

                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{plan.name}</h4>
                            <div className="flex items-baseline mb-4">
                              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{plan.price}</span>
                              <span className="text-gray-500 dark:text-gray-400 ml-1">{plan.period}</span>
                            </div>

                            <ul className="space-y-2 mb-6">
                              {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <i className="fas fa-check text-green-500 mt-0.5 flex-shrink-0"></i>
                                  {feature}
                                </li>
                              ))}
                            </ul>

                            {isCurrentPlan ? (
                              <button
                                onClick={handleManageBilling}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                              >
                                Manage Plan
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCheckout(plan.stripePriceId)}
                                disabled={!!checkoutLoading || !plan.stripePriceId}
                                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                  plan.popular
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                                    : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-400'
                                }`}
                              >
                                {checkoutLoading === plan.stripePriceId ? (
                                  <><i className="fas fa-spinner fa-spin mr-2"></i>Loading...</>
                                ) : billingData?.subscription ? (
                                  'Switch Plan'
                                ) : (
                                  'Start Free Trial'
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
                      All plans include a 14-day free trial. Cancel anytime. Prices in USD.
                    </p>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Coming Soon Sections */}
          {(['messaging', 'email', 'team', 'auto-reply'] as const).includes(activeSection as 'messaging' | 'email' | 'team' | 'auto-reply') && (
            <section className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-tools text-gray-400 dark:text-gray-500 text-2xl"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Coming Soon</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  This feature is under development and will be available soon.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
