'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
};

const STEPS = [
  { num: 1, title: 'Your Profile', icon: 'fa-user', desc: 'Name, brokerage, phone' },
  { num: 2, title: 'Import Leads', icon: 'fa-users', desc: 'Upload CSV or start fresh' },
  { num: 3, title: 'AI Personality', icon: 'fa-brain', desc: 'Customize your AI assistant' },
  { num: 4, title: 'First Campaign', icon: 'fa-paper-plane', desc: 'Send your first outreach' },
  { num: 5, title: 'You\'re Live!', icon: 'fa-check-circle', desc: 'Your AI agent is ready' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  // Lead count
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/profile').then(r => r.json()),
      fetch('/api/leads?limit=1').then(r => r.json()),
    ]).then(([profileData, leadsData]) => {
      if (profileData.ok && profileData.profile) {
        setProfile(profileData.profile);
        if (profileData.profile.full_name) setFullName(profileData.profile.full_name);
        if (profileData.profile.company) setCompany(profileData.profile.company);
        if (profileData.profile.phone) setPhone(profileData.profile.phone);

        // Auto-advance past completed steps
        if (profileData.profile.full_name && profileData.profile.company && profileData.profile.phone) {
          setStep(2); // Profile done, go to leads
        }
      }
      if (leadsData.ok) {
        setLeadCount(leadsData.total || 0);
        if (leadsData.total > 0 && profileData.profile?.full_name) {
          setStep(3); // Has leads, go to AI config
        }
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    if (!fullName.trim()) { setError('Please enter your name'); return; }
    if (!company.trim()) { setError('Please enter your company'); return; }
    if (!phone.trim()) { setError('Please enter your phone'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), company: company.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.ok) setStep(2);
      else setError(data.error || 'Failed to save');
    } catch { setError('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const firstName = fullName.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <i className="fas fa-home text-white text-sm"></i>
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)]">Estate AI</span>
            <span className="text-sm text-[var(--text-secondary)] ml-2">Setup</span>
          </div>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
            Skip to Dashboard <i className="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* Progress bar */}
          <div className="flex items-center justify-between mb-10">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    step > s.num ? 'bg-emerald-500 text-white' :
                    step === s.num ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' :
                    'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]'
                  }`}>
                    {step > s.num ? <i className="fas fa-check text-xs"></i> : <i className={`fas ${s.icon} text-xs`}></i>}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium hidden sm:block ${step === s.num ? 'text-blue-500' : 'text-[var(--text-secondary)]'}`}>{s.title}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 sm:w-20 h-0.5 mx-1 ${step > s.num ? 'bg-emerald-500' : 'bg-[var(--border)]'}`}></div>
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {/* ── STEP 1: Profile ── */}
          {step === 1 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome to Estate AI!</h2>
                <p className="text-[var(--text-secondary)] mt-1">Let&apos;s set up your profile so the AI knows who you are.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Full Name *</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Nadine Khalil"
                    className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" autoFocus />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">This appears in all your outreach messages.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Company / Brokerage *</label>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. KW Commercial"
                    className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Phone Number *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +1 (555) 123-4567"
                    className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">For email signatures and lead callbacks.</p>
                </div>
              </div>
              <button onClick={saveProfile} disabled={saving}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-50 cursor-pointer transition-colors">
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          )}

          {/* ── STEP 2: Import Leads ── */}
          {step === 2 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Import Your Leads</h2>
                <p className="text-[var(--text-secondary)] mt-1">Get your contacts into Estate AI so the AI can start working.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => router.push('/leads?import=true')}
                  className="p-5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl hover:border-blue-500 transition-all text-left cursor-pointer group">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                    <i className="fas fa-file-csv text-blue-500"></i>
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm">Upload CSV</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Import from MLS, Follow Up Boss, Zillow, or any spreadsheet</p>
                </button>

                <button onClick={() => router.push('/settings?tab=integrations')}
                  className="p-5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl hover:border-blue-500 transition-all text-left cursor-pointer group">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
                    <i className="fas fa-plug text-purple-500"></i>
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm">Connect Follow Up Boss</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Sync your FUB contacts automatically</p>
                </button>
              </div>

              <div className="text-center">
                <button onClick={() => router.push('/leads')}
                  className="text-sm text-blue-500 hover:text-blue-400 cursor-pointer">
                  Or add leads manually <i className="fas fa-arrow-right ml-1"></i>
                </button>
              </div>

              {leadCount > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-400 text-sm text-center">
                  <i className="fas fa-check-circle mr-2"></i>You have {leadCount} leads imported!
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                  <i className="fas fa-arrow-left mr-1"></i> Back
                </button>
                <button onClick={() => setStep(3)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 cursor-pointer text-sm transition-colors">
                  {leadCount > 0 ? 'Continue' : 'Skip for now'} <i className="fas fa-arrow-right ml-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: AI Personality ── */}
          {step === 3 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Customize Your AI Agent</h2>
                <p className="text-[var(--text-secondary)] mt-1">Your AI assistant will use your name and style when talking to leads.</p>
              </div>

              <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {fullName.charAt(0) || 'A'}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{fullName || 'Your Agent'}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{company || 'Your Brokerage'}</p>
                  </div>
                </div>

                <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Your AI will sound like this:</p>
                  <p className="text-sm text-[var(--text-primary)] italic">
                    &ldquo;Hi! We recently sold a building nearby and have an overflow of buyers looking in your area.
                    Would you be open to a brief chat about what similar properties have been going for?
                    <br /><br />P.S. My AI assistant helps me respond quickly, but I&apos;m always in the loop.
                    <br />— {fullName}, {company}&rdquo;
                  </p>
                </div>

                <p className="text-xs text-[var(--text-secondary)]">
                  <i className="fas fa-info-circle mr-1"></i>
                  You can fine-tune the AI&apos;s tone, language, and custom questions in Settings &gt; AI Personality anytime.
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(2)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                  <i className="fas fa-arrow-left mr-1"></i> Back
                </button>
                <div className="flex gap-3">
                  <button onClick={() => router.push('/settings?tab=ai-personality')}
                    className="text-sm text-blue-500 hover:text-blue-400 cursor-pointer px-4 py-2.5">
                    Customize AI <i className="fas fa-cog ml-1"></i>
                  </button>
                  <button onClick={() => setStep(4)}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 cursor-pointer text-sm transition-colors">
                    Looks Good <i className="fas fa-arrow-right ml-1"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: First Campaign ── */}
          {step === 4 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Send Your First Campaign</h2>
                <p className="text-[var(--text-secondary)] mt-1">Choose a template and reach out to your leads.</p>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'Commercial Prospecting', desc: 'Cold outreach to property owners — "We have buyers looking in your area"', icon: 'fa-building' },
                  { name: 'Free Property Valuation', desc: 'Offer a CMA — great lead magnet for any owner', icon: 'fa-chart-line' },
                  { name: 'Circle Prospecting', desc: 'Ask neighbors for referrals — "Who do you know thinking of moving?"', icon: 'fa-street-view' },
                ].map(t => (
                  <button key={t.name} onClick={() => router.push('/campaigns')}
                    className="w-full p-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl hover:border-blue-500 transition-all text-left cursor-pointer flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className={`fas ${t.icon} text-blue-500`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)] text-sm">{t.name}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t.desc}</p>
                    </div>
                    <i className="fas fa-chevron-right text-[var(--text-secondary)] text-xs ml-auto"></i>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(3)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                  <i className="fas fa-arrow-left mr-1"></i> Back
                </button>
                <button onClick={() => setStep(5)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-500 cursor-pointer text-sm transition-colors">
                  Skip for now <i className="fas fa-arrow-right ml-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Done ── */}
          {step === 5 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                <i className="fas fa-check-circle text-emerald-500 text-3xl"></i>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">You&apos;re All Set, {firstName}!</h2>
                <p className="text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
                  Your AI agent is ready to go. It will respond to inbound WhatsApp and SMS messages 24/7
                  using your name and brokerage.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg p-3">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{leadCount}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Leads imported</p>
                </div>
                <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg p-3">
                  <p className="text-2xl font-bold text-emerald-500">Active</p>
                  <p className="text-xs text-[var(--text-secondary)]">AI Agent status</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button onClick={() => router.push('/dashboard')}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-500 cursor-pointer transition-colors">
                  Go to Dashboard <i className="fas fa-arrow-right ml-2"></i>
                </button>
                <button onClick={() => router.push('/campaigns')}
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] py-3 rounded-lg font-medium hover:bg-[var(--border)] cursor-pointer transition-colors">
                  Send First Campaign <i className="fas fa-paper-plane ml-2"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
