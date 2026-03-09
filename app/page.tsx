'use client';

import Link from 'next/link';
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { Footer } from './components/Footer';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const router = useRouter();

  // Sync dark mode with localStorage (same key as ThemeProvider)
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setError(error.message);
        } else {
          router.push('/prototype/dashboard');
          router.refresh();
        }
      } catch {
        setError('An unexpected error occurred.');
      }
    });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const company = formData.get('company') as string;

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: `${firstName} ${lastName}`.trim(),
              company,
            },
          },
        });

        if (error) {
          setError(error.message);
        } else if (data.user && !data.session) {
          setError('Check your email to confirm your account before signing in.');
        } else {
          router.push('/prototype/dashboard');
          router.refresh();
        }
      } catch {
        setError('An unexpected error occurred.');
      }
    });
  }

  return (
    <div className="min-h-screen flex bg-[var(--background)] transition-colors">
      {/* LEFT PANEL (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Richer gradient: primary → deep navy */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB] via-[#1E40AF] to-[#0C1A3D] dark:from-[#1E3A8A] dark:via-[#162557] dark:to-[#0C0F1A]" />
        {/* Mesh grid overlay */}
        <div className="absolute inset-0 mesh-grid" />
        {/* Subtle radial glow */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <i className="fas fa-home text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-white">Estate AI</h1>
                <p className="text-blue-200/80 text-sm">Agent Assistant</p>
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-heading font-extrabold text-white mb-6 leading-tight">
              Streamline Your Real Estate Business
            </h2>
            <p className="text-lg text-blue-100/90 mb-8 leading-relaxed">
              Automate lead management, multi-channel outreach, and appointment scheduling with our
              AI-driven platform.
            </p>

            <div className="space-y-4 mb-8">
              {[
                'AI-powered SMS, Email & WhatsApp campaigns',
                'Lead scoring & drag-and-drop pipeline',
                'Automated follow-ups & compliance monitoring',
                'Calendar integration & appointment scheduling',
              ].map((text) => (
                <div key={text} className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-emerald-400/20 rounded-full flex items-center justify-center flex-shrink-0 border border-emerald-400/30">
                    <i className="fas fa-check text-emerald-300 text-xs" />
                  </div>
                  <span className="text-blue-100/90 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Frosted glass testimonial */}
          <div className="absolute bottom-8 left-12 right-12">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400/40 to-blue-600/40 rounded-full flex items-center justify-center text-white font-bold text-lg border border-white/20">
                  N
                </div>
                <div>
                  <p className="text-white font-semibold">Nadine Khalil</p>
                  <p className="text-blue-200/70 text-sm">KW Commercial</p>
                </div>
              </div>
              <p className="text-blue-100/80 italic leading-relaxed">
                &quot;Estate AI transformed my outreach. I&apos;ve increased my lead conversion
                by 40% and saved 15 hours per week on follow-ups.&quot;
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (auth forms) */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-[var(--primary)] rounded-lg flex items-center justify-center">
                <i className="fas fa-home text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-[var(--text-primary)]">Estate AI</h1>
                <p className="text-sm text-[var(--text-secondary)]">Agent Assistant</p>
              </div>
            </div>
          </div>

          {/* Theme toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] transition-colors"
              title={dark ? 'Light Mode' : 'Dark Mode'}
            >
              <i className={`fas ${dark ? 'fa-sun' : 'fa-moon'} text-lg`} />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] mb-8">
            <button
              className={`flex-1 py-3 px-1 text-center border-b-2 font-medium transition-colors ${
                activeTab === 'signin'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => { setActiveTab('signin'); setError(null); }}
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-3 px-1 text-center border-b-2 font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => { setActiveTab('signup'); setError(null); }}
            >
              Sign Up
            </button>
          </div>

          {/* SIGN IN FORM */}
          {activeTab === 'signin' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-heading font-bold text-[var(--text-primary)] mb-2">Welcome back</h2>
                <p className="text-[var(--text-secondary)]">Sign in to your account to continue</p>
              </div>

              <form className="space-y-6" onSubmit={handleSignIn}>
                <div>
                  <label htmlFor="signin-email" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-envelope text-[var(--text-secondary)]" />
                    </div>
                    <input
                      id="signin-email"
                      name="email"
                      type="email"
                      required
                      disabled={isPending}
                      className="block w-full pl-10 pr-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signin-password" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-[var(--text-secondary)]" />
                    </div>
                    <input
                      id="signin-password"
                      name="password"
                      type={showSigninPassword ? 'text' : 'password'}
                      required
                      disabled={isPending}
                      className="block w-full pl-10 pr-10 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowSigninPassword((prev) => !prev)}
                    >
                      <i className={`fas ${showSigninPassword ? 'fa-eye-slash' : 'fa-eye'} text-[var(--text-secondary)] hover:text-[var(--text-primary)]`} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-[var(--primary)] border-[var(--border)] rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--text-secondary)]">
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setError(null); setForgotSent(false); }}
                    className="text-sm text-[var(--primary)] hover:opacity-80 transition-opacity"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Forgot Password Inline Form */}
                {showForgotPassword && (
                  <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg p-4 space-y-3">
                    {forgotSent ? (
                      <div className="text-center">
                        <i className="fas fa-check-circle text-[var(--accent)] text-2xl mb-2"></i>
                        <p className="text-sm text-[var(--text-primary)] font-medium">Reset link sent!</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">Check your email for a password reset link.</p>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}
                          className="text-sm text-[var(--primary)] mt-3 hover:opacity-80"
                        >
                          Back to sign in
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-[var(--text-secondary)]">Enter your email to receive a reset link.</p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                          />
                          <button
                            type="button"
                            disabled={forgotLoading || !forgotEmail}
                            onClick={async () => {
                              setForgotLoading(true);
                              setError(null);
                              try {
                                const supabase = createClient();
                                const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                                  redirectTo: `${window.location.origin}/reset-password`,
                                });
                                if (error) {
                                  setError(error.message);
                                } else {
                                  setForgotSent(true);
                                }
                              } catch {
                                setError('Failed to send reset email');
                              } finally {
                                setForgotLoading(false);
                              }
                            }}
                            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                          >
                            {forgotLoading ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-[var(--primary)] text-white py-3 px-4 rounded-lg font-heading font-semibold hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}

          {/* SIGN UP FORM */}
          {activeTab === 'signup' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-heading font-bold text-[var(--text-primary)] mb-2">
                  Create your account
                </h2>
                <p className="text-[var(--text-secondary)]">Start your 14-day free trial today</p>
              </div>

              <form className="space-y-6" onSubmit={handleSignUp}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      First name
                    </label>
                    <input
                      id="first-name"
                      name="firstName"
                      type="text"
                      required
                      disabled={isPending}
                      className="block w-full px-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Last name
                    </label>
                    <input
                      id="last-name"
                      name="lastName"
                      type="text"
                      required
                      disabled={isPending}
                      className="block w-full px-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-envelope text-[var(--text-secondary)]" />
                    </div>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      disabled={isPending}
                      className="block w-full pl-10 pr-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Company/Agency
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    disabled={isPending}
                    className="block w-full px-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                    placeholder="Real Estate Company"
                  />
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-[var(--text-secondary)]" />
                    </div>
                    <input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      disabled={isPending}
                      className="block w-full pl-10 pr-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] disabled:opacity-50 transition-colors"
                      placeholder="Create a password"
                    />
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Must be at least 8 characters with numbers and letters
                  </p>
                </div>

                <div className="flex items-start">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    className="h-4 w-4 text-[var(--primary)] border-[var(--border)] rounded mt-1"
                  />
                  <label htmlFor="terms" className="ml-2 block text-sm text-[var(--text-secondary)]">
                    I agree to the{' '}
                    <Link href="/terms" className="text-[var(--primary)] hover:opacity-80">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy" className="text-[var(--primary)] hover:opacity-80">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-[var(--primary)] text-white py-3 px-4 rounded-lg font-heading font-semibold hover:bg-[var(--primary-hover)] transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            </div>
          )}

          {/* Features strip */}
          <div className="mt-8 pt-8 border-t border-[var(--border)]">
            <h3 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-4">
              Why choose Estate AI?
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-robot text-blue-600 dark:text-blue-400 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">AI-Powered Automation</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Smart lead scoring and automated follow-ups
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-shield-alt text-emerald-600 dark:text-emerald-400 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Compliance Ready</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Built-in A2P registration and monitoring
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-purple-600 dark:text-purple-400 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">Performance Analytics</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Track campaigns and optimize conversion rates
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
