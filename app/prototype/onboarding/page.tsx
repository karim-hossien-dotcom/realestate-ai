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

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  // Current step
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Fetch existing profile
  useEffect(() => {
    fetch('/api/settings/profile')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.profile) {
          setProfile(data.profile);
          // Pre-fill any existing data
          if (data.profile.full_name) setFullName(data.profile.full_name);
          if (data.profile.company) setCompany(data.profile.company);
          if (data.profile.phone) setPhone(data.profile.phone);

          // If profile is already complete, redirect to dashboard
          if (data.profile.full_name && data.profile.company && data.profile.phone) {
            router.push('/prototype/dashboard');
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const handleNext = () => {
    // Validate current step
    if (step === 1 && !fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (step === 2 && !company.trim()) {
      setError('Please enter your company name');
      return;
    }

    setError(null);
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          company: company.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Redirect to dashboard
        router.push('/prototype/dashboard');
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

  const handleSkip = () => {
    router.push('/prototype/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <i className="fas fa-home text-blue-600 text-xl"></i>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">RealEstate AI</h1>
              <p className="text-blue-200">Agent Assistant</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Progress indicator */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    s < step
                      ? 'bg-green-500 text-white'
                      : s === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? <i className="fas fa-check"></i> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-1 mx-2 ${
                      s < step ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome! Let&apos;s get started</h2>
                <p className="text-gray-600">First, tell us your name</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Nadine Khalil"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  This name will appear in your outreach emails and messages.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Company */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Great, {fullName.split(' ')[0]}!</h2>
                <p className="text-gray-600">Now, what company or brokerage are you with?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company / Brokerage <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. KW Commercial"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  Your company name helps build trust with leads.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Phone */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost done!</h2>
                <p className="text-gray-600">What&apos;s the best phone number to reach you?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 123-4567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  This will be included in your email signatures and for lead callbacks.
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Your Profile Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name:</span>
                    <span className="font-medium text-gray-900">{fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Company:</span>
                    <span className="font-medium text-gray-900">{company}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium text-gray-900">{profile?.email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Skip for now
              </button>
            )}

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center"
              >
                Continue
                <i className="fas fa-arrow-right ml-2"></i>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 flex items-center"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <i className="fas fa-check ml-2"></i>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-200 text-sm mt-6">
          You can update these details anytime in Settings
        </p>
      </div>
    </div>
  );
}
