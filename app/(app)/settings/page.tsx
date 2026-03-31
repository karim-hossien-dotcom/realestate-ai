'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  type Profile,
  type FUBStatus,
  type SettingsSection,
  type BillingData,
  type AiConfig,
  type PlanDef,
  settingsSections,
} from '@/app/components/settings/types';
import ProfileTab from '@/app/components/settings/ProfileTab';
import CrmTab from '@/app/components/settings/CrmTab';
import AiScriptTab from '@/app/components/settings/AiScriptTab';
import BillingTab from '@/app/components/settings/BillingTab';

const plans: PlanDef[] = [
  {
    slug: 'starter',
    name: 'Starter',
    price: '$99',
    period: '/mo',
    features: ['Up to 250 leads', '750 SMS/month', 'WhatsApp + Email + SMS', 'AI message generation', 'Lead scoring', 'Basic analytics', '1 user'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '',
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: '$249',
    period: '/mo',
    popular: true,
    features: ['Up to 1,000 leads', '3,000 SMS/month', 'Everything in Starter', 'Follow-up automation', 'CRM integration', 'Advanced analytics', 'Priority support', 'Up to 5 users'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: '$499',
    period: '/mo',
    features: ['Unlimited leads', '15,000 SMS/month', 'Everything in Pro', 'Team management', 'White-label reports', 'Dedicated support', 'Custom integrations', 'Up to 15 users'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID || '',
  },
];

const VALID_SECTIONS: SettingsSection[] = [
  'profile', 'integrations', 'ai-personality', 'messaging', 'email', 'team', 'auto-reply', 'billing',
];

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-secondary)]">Loading settings...</div>}>
      <SettingsPage />
    </Suspense>
  );
}

function SettingsPage() {
  const searchParams = useSearchParams();
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
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // AI Personality state
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    tone: 'professional',
    language: 'english',
    introduction_template: null,
    qualification_questions: [],
    escalation_message: null,
    closing_style: 'direct',
    property_focus: 'general',
    custom_instructions: null,
    active: true,
  });
  const [aiConfigLoading, setAiConfigLoading] = useState(false);
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [aiConfigSuccess, setAiConfigSuccess] = useState<string | null>(null);

  // Set active tab from URL param (e.g. ?tab=integrations from onboarding)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_SECTIONS.includes(tab as SettingsSection)) {
      setActiveSection(tab as SettingsSection);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchProfile();
    fetchFubStatus();
  }, []);

  useEffect(() => {
    if (activeSection === 'billing') {
      fetchBillingData();
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'ai-personality') {
      fetchAiConfig();
    }
  }, [activeSection]);

  /* --- Data fetchers --- */

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

  const fetchFubStatus = async () => {
    try {
      const response = await fetch('/api/integrations/fub/status');
      const data = await response.json();
      if (data.ok) setFubStatus(data);
    } catch { /* ignore */ }
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

  const fetchAiConfig = async () => {
    setAiConfigLoading(true);
    setAiConfigError(null);
    try {
      const response = await fetch('/api/settings/ai-script');
      const data = await response.json();
      if (data.ok && data.config) {
        setAiConfig(data.config);
      } else {
        setAiConfigError(data.error || 'Failed to load AI config');
      }
    } catch {
      setAiConfigError('Failed to load AI config');
    } finally {
      setAiConfigLoading(false);
    }
  };

  /* --- Profile handlers --- */

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

  /* --- FUB handlers --- */

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

  /* --- Billing handlers --- */

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

  /* --- AI config handlers --- */

  const handleSaveAiConfig = async () => {
    setAiConfigSaving(true);
    setAiConfigError(null);
    setAiConfigSuccess(null);
    try {
      const response = await fetch('/api/settings/ai-script', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig),
      });
      const data = await response.json();
      if (data.ok) {
        setAiConfig(data.config);
        setAiConfigSuccess('AI personality saved successfully!');
        setTimeout(() => setAiConfigSuccess(null), 3000);
      } else {
        setAiConfigError(data.error || 'Failed to save');
      }
    } catch {
      setAiConfigError('Failed to save AI config');
    } finally {
      setAiConfigSaving(false);
    }
  };

  const handleAddQuestion = () => {
    if (aiConfig.qualification_questions.length < 10) {
      setAiConfig({ ...aiConfig, qualification_questions: [...aiConfig.qualification_questions, ''] });
    }
  };

  const handleUpdateQuestion = (index: number, value: string) => {
    const updated = aiConfig.qualification_questions.map((q, i) => i === index ? value : q);
    setAiConfig({ ...aiConfig, qualification_questions: updated });
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = aiConfig.qualification_questions.filter((_, i) => i !== index);
    setAiConfig({ ...aiConfig, qualification_questions: updated });
  };

  /* --- Render --- */


  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-secondary)]">Manage your profile, integrations, and platform configuration</p>
      </div>

      {/* Horizontal Tab Bar */}
      <div className="flex overflow-x-auto border-b border-[var(--border)] gap-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
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
          {activeSection === 'profile' && (
            <ProfileTab
              profile={profile}
              fullName={fullName}
              company={company}
              phone={phone}
              saving={saving}
              error={error}
              success={success}
              hasChanges={hasChanges}
              onFullNameChange={setFullName}
              onCompanyChange={setCompany}
              onPhoneChange={setPhone}
              onSave={handleSaveProfile}
            />
          )}

          {activeSection === 'integrations' && (
            <CrmTab
              fubStatus={fubStatus}
              fubApiKey={fubApiKey}
              fubConnecting={fubConnecting}
              fubSyncing={fubSyncing}
              fubError={fubError}
              fubSuccess={fubSuccess}
              onApiKeyChange={setFubApiKey}
              onConnect={handleFubConnect}
              onDisconnect={handleFubDisconnect}
              onSync={handleFubSync}
            />
          )}

          {activeSection === 'ai-personality' && (
            <AiScriptTab
              aiConfig={aiConfig}
              aiConfigLoading={aiConfigLoading}
              aiConfigSaving={aiConfigSaving}
              aiConfigError={aiConfigError}
              aiConfigSuccess={aiConfigSuccess}
              onConfigChange={setAiConfig}
              onAddQuestion={handleAddQuestion}
              onUpdateQuestion={handleUpdateQuestion}
              onRemoveQuestion={handleRemoveQuestion}
              onSave={handleSaveAiConfig}
            />
          )}

          {activeSection === 'billing' && (
            <BillingTab
              billingData={billingData}
              billingLoading={billingLoading}
              billingError={billingError}
              checkoutLoading={checkoutLoading}
              plans={plans}
              onCheckout={handleCheckout}
              onManageBilling={handleManageBilling}
            />
          )}

        </>
      )}
    </div>
  );
}
