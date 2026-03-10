'use client';

import Link from 'next/link';
import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { Footer } from './components/Footer';

// ─── Grid Background SVG Pattern ───────────────────────────────
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.4" />
          </pattern>
          <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="70%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" mask="url(#grid-mask)" />
      </svg>
      {/* Radial glow accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--primary)_0%,_transparent_70%)] opacity-[0.04]" />
    </div>
  );
}

// ─── Sticky Navbar ─────────────────────────────────────────────
function Navbar({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] rounded-lg flex items-center justify-center">
              <i className="fas fa-home text-white text-sm" />
            </div>
            <span className="text-lg font-heading font-bold text-[var(--text-primary)]">Estate AI</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Pricing</a>
          </div>

          {/* Desktop auth buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={onSignIn}
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2"
            >
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Start for Free
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-lg`} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-[var(--border)] mt-2 pt-4 space-y-3 bg-[var(--surface)] rounded-b-lg">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5">How It Works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5">Pricing</a>
            <div className="pt-3 border-t border-[var(--border)] space-y-2 px-2">
              <button onClick={() => { setMobileMenuOpen(false); onSignIn(); }} className="block w-full text-sm text-[var(--text-primary)] font-medium text-left py-1.5">Sign In</button>
              <button onClick={() => { setMobileMenuOpen(false); onSignUp(); }} className="block w-full text-sm text-white bg-[var(--primary)] px-4 py-2 rounded-lg text-center font-medium">Start for Free</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Auth Modal ────────────────────────────────────────────────
function AuthModal({
  isOpen,
  onClose,
  initialTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialTab: 'signin' | 'signup';
}) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
      setShowForgotPassword(false);
    }
  }, [isOpen, initialTab]);

  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

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
          router.push('/dashboard');
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
          router.push('/dashboard');
          router.refresh();
        }
      } catch {
        setError('An unexpected error occurred.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] animate-fade-in-up overflow-y-auto max-h-[90vh]"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
        >
          <i className="fas fa-times text-lg" />
        </button>

        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center space-x-2.5 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] rounded-lg flex items-center justify-center">
              <i className="fas fa-home text-white text-sm" />
            </div>
            <span className="text-lg font-heading font-bold text-[var(--text-primary)]">Estate AI</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] mb-6">
            <button
              className={`flex-1 py-2.5 text-center border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'signin'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => { setActiveTab('signin'); setError(null); setShowForgotPassword(false); }}
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-2.5 text-center border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              onClick={() => { setActiveTab('signup'); setError(null); setShowForgotPassword(false); }}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Welcome back</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Sign in to your account to continue</p>
              </div>

              <form className="space-y-4" onSubmit={handleSignIn}>
                <div>
                  <label htmlFor="modal-signin-email" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Email</label>
                  <input
                    id="modal-signin-email"
                    name="email"
                    type="email"
                    required
                    disabled={isPending}
                    className="block w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="modal-signin-password" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      id="modal-signin-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isPending}
                      className="block w-full px-3 py-2.5 pr-10 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)]`} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setError(null); setForgotSent(false); }}
                    className="text-sm text-[var(--primary)] hover:opacity-80 transition-opacity"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Forgot Password */}
                {showForgotPassword && (
                  <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg p-4 space-y-3">
                    {forgotSent ? (
                      <div className="text-center">
                        <i className="fas fa-check-circle text-[var(--accent)] text-2xl mb-2" />
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
                                if (error) setError(error.message);
                                else setForgotSent(true);
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
                  className="w-full bg-[var(--primary)] text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Create your account</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Start your 14-day free trial today</p>
              </div>

              <form className="space-y-4" onSubmit={handleSignUp}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="modal-first-name" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">First name</label>
                    <input id="modal-first-name" name="firstName" type="text" required disabled={isPending}
                      className="block w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                      placeholder="John" />
                  </div>
                  <div>
                    <label htmlFor="modal-last-name" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Last name</label>
                    <input id="modal-last-name" name="lastName" type="text" required disabled={isPending}
                      className="block w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                      placeholder="Smith" />
                  </div>
                </div>

                <div>
                  <label htmlFor="modal-signup-email" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Email</label>
                  <input id="modal-signup-email" name="email" type="email" required disabled={isPending}
                    className="block w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                    placeholder="you@example.com" />
                </div>

                <div>
                  <label htmlFor="modal-company" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Company / Agency</label>
                  <input id="modal-company" name="company" type="text" disabled={isPending}
                    className="block w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                    placeholder="Real Estate Company" />
                </div>

                <div>
                  <label htmlFor="modal-signup-password" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Password</label>
                  <input id="modal-signup-password" name="password" type="password" required minLength={8} disabled={isPending}
                    className="block w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm disabled:opacity-50 transition-colors"
                    placeholder="Min. 8 characters" />
                </div>

                <div className="flex items-start">
                  <input id="modal-terms" type="checkbox" required className="h-4 w-4 text-[var(--primary)] border-[var(--border)] rounded mt-0.5" />
                  <label htmlFor="modal-terms" className="ml-2 text-sm text-[var(--text-secondary)]">
                    I agree to the{' '}
                    <Link href="/terms" className="text-[var(--primary)] hover:opacity-80">Terms</Link>{' '}and{' '}
                    <Link href="/privacy-policy" className="text-[var(--primary)] hover:opacity-80">Privacy Policy</Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-[var(--primary)] text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Feature Card ──────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div className={`group relative bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--primary)] transition-all duration-300 hover:shadow-lg cursor-default animate-fade-in-up ${delay}`}>
      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <i className={`fas ${icon} text-[var(--primary)] text-lg`} />
      </div>
      <h3 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Stat Counter ──────────────────────────────────────────────
function StatItem({ value, label, delay }: { value: string; label: string; delay: string }) {
  return (
    <div className={`text-center animate-fade-in-up ${delay}`}>
      <p className="text-3xl sm:text-4xl font-heading font-extrabold text-[var(--text-primary)]">{value}</p>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{label}</p>
    </div>
  );
}

// ─── Pricing Card ──────────────────────────────────────────────
function PricingCard({
  name,
  price,
  features,
  popular,
  onSignUp,
  delay,
}: {
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
  onSignUp: () => void;
  delay: string;
}) {
  return (
    <div className={`relative bg-[var(--surface)] border rounded-xl p-6 animate-fade-in-up ${delay} ${
      popular ? 'border-[var(--primary)] shadow-lg ring-1 ring-[var(--primary)]' : 'border-[var(--border)]'
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-white text-xs font-medium px-3 py-1 rounded-full">
          Most Popular
        </div>
      )}
      <h3 className="text-lg font-heading font-semibold text-[var(--text-primary)]">{name}</h3>
      <div className="mt-3 mb-5">
        <span className="text-4xl font-heading font-extrabold text-[var(--text-primary)]">${price}</span>
        <span className="text-sm text-[var(--text-secondary)]">/mo</span>
      </div>
      <ul className="space-y-2.5 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
            <i className="fas fa-check text-[var(--accent)] mt-0.5 text-xs" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onSignUp}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
          popular
            ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
            : 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--border)]'
        }`}
      >
        Get Started
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function LandingPage() {
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: 'signin' | 'signup' }>({ open: false, tab: 'signin' });
  const [dark, setDark] = useState(false);

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

  const openSignIn = () => setAuthModal({ open: true, tab: 'signin' });
  const openSignUp = () => setAuthModal({ open: true, tab: 'signup' });

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] transition-colors">
      {/* Navbar */}
      <Navbar onSignIn={openSignIn} onSignUp={openSignUp} />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModal.open}
        onClose={() => setAuthModal({ ...authModal, open: false })}
        initialTab={authModal.tab}
      />

      {/* ────── HERO SECTION ────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <GridBackground />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 text-center">
          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-1.5 mb-8 animate-fade-in-up shadow-sm">
            <span className="bg-[var(--accent)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">New</span>
            <span className="text-sm text-[var(--text-secondary)]">AI-powered follow-ups now available</span>
            <i className="fas fa-arrow-right text-[var(--text-secondary)] text-xs" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold leading-[1.1] tracking-tight mb-6 animate-fade-in-up delay-100">
            The AI-Powered CRM
            <br />
            <span className="bg-gradient-to-r from-[var(--primary)] to-[#1E40AF] dark:from-[#4F7BF7] dark:to-[#2563EB] bg-clip-text text-transparent">
              for Real Estate Agents
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
            Automate lead outreach across WhatsApp, SMS, and Email.
            Score leads with AI. Book more appointments. Close more deals.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up delay-300">
            <button
              onClick={openSignUp}
              className="w-full sm:w-auto bg-[var(--primary)] text-white px-8 py-3 rounded-lg font-heading font-semibold hover:bg-[var(--primary-hover)] hover:shadow-lg transition-all shadow-sm text-sm"
            >
              Start for Free
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] px-8 py-3 rounded-lg font-heading font-semibold hover:bg-[var(--surface-elevated)] transition-all text-sm"
            >
              See How It Works
            </button>
          </div>

          {/* Social proof line */}
          <p className="mt-10 text-sm text-[var(--text-secondary)] animate-fade-in-up delay-400">
            Trusted by <span className="text-[var(--text-primary)] font-medium">500+</span> real estate agents across North America
          </p>
        </div>
      </section>

      {/* ────── STATS BAR ────── */}
      <section className="border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <StatItem value="10K+" label="Leads Managed" delay="delay-100" />
          <StatItem value="50K+" label="Messages Sent" delay="delay-200" />
          <StatItem value="40%" label="More Conversions" delay="delay-300" />
          <StatItem value="15hrs" label="Saved Per Week" delay="delay-400" />
        </div>
      </section>

      {/* ────── FEATURES GRID ────── */}
      <section id="features" className="relative py-20 sm:py-28">
        <GridBackground />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-[var(--primary)] uppercase tracking-wider mb-3 animate-fade-in-up">Features</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[var(--text-primary)] mb-4 animate-fade-in-up delay-100">
              Everything you need to close more deals
            </h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto animate-fade-in-up delay-200">
              From lead capture to appointment booking, Estate AI handles the entire pipeline so you can focus on what matters — selling.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon="fa-paper-plane"
              title="Multi-Channel Outreach"
              description="Send campaigns across WhatsApp, SMS, and Email from a single dashboard. AI personalizes every message."
              delay="delay-100"
            />
            <FeatureCard
              icon="fa-brain"
              title="AI Lead Scoring"
              description="Every lead gets a 0-100 score based on engagement, intent, response time, and profile completeness."
              delay="delay-200"
            />
            <FeatureCard
              icon="fa-clock"
              title="Automated Follow-Ups"
              description="AI generates and schedules follow-up messages. Never miss a window to re-engage a hot lead."
              delay="delay-300"
            />
            <FeatureCard
              icon="fa-comments"
              title="Inbound AI Agent"
              description="Your AI assistant handles inbound messages 24/7 — qualifies leads, answers questions, and books meetings."
              delay="delay-400"
            />
            <FeatureCard
              icon="fa-calendar-check"
              title="Calendar Integration"
              description="Sync with Google Calendar or Apple Calendar. Leads can book directly into your availability."
              delay="delay-500"
            />
            <FeatureCard
              icon="fa-chart-line"
              title="Analytics Dashboard"
              description="Track campaign performance, lead conversion rates, and agent productivity in real-time."
              delay="delay-600"
            />
          </div>
        </div>
      </section>

      {/* ────── HOW IT WORKS ────── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-[var(--surface)] border-y border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-[var(--primary)] uppercase tracking-wider mb-3 animate-fade-in-up">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[var(--text-primary)] mb-4 animate-fade-in-up delay-100">
              From lead to close in 3 steps
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Import Leads', desc: 'Upload a CSV or sync from Follow Up Boss. Duplicates are auto-detected.', icon: 'fa-upload' },
              { step: '2', title: 'Launch Campaign', desc: 'Pick a channel, write your message (or let AI do it), and hit send.', icon: 'fa-rocket' },
              { step: '3', title: 'AI Handles the Rest', desc: 'AI responds to inquiries, scores leads, schedules follow-ups, and books appointments.', icon: 'fa-robot' },
            ].map((item) => (
              <div key={item.step} className={`text-center animate-fade-in-up delay-${Number(item.step) * 100 + 100}`}>
                <div className="w-14 h-14 mx-auto bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-5">
                  <i className={`fas ${item.icon} text-[var(--primary)] text-xl`} />
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 bg-[var(--primary)] text-white text-sm font-bold rounded-full mb-3">{item.step}</div>
                <h3 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────── PRICING ────── */}
      <section id="pricing" className="relative py-20 sm:py-28">
        <GridBackground />
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-[var(--primary)] uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[var(--text-primary)] mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-[var(--text-secondary)]">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <PricingCard
              name="Starter"
              price="99"
              features={[
                'Up to 200 leads',
                '500 messages/month',
                'AI lead scoring',
                'Email campaigns',
                'Basic analytics',
              ]}
              onSignUp={openSignUp}
              delay="delay-100"
            />
            <PricingCard
              name="Pro"
              price="249"
              popular
              features={[
                'Up to 1,000 leads',
                '2,000 messages/month',
                'WhatsApp + SMS + Email',
                'AI follow-ups',
                'Calendar integration',
                'Advanced analytics',
              ]}
              onSignUp={openSignUp}
              delay="delay-200"
            />
            <PricingCard
              name="Agency"
              price="499"
              features={[
                'Unlimited leads',
                '10,000 messages/month',
                'All channels',
                'AI inbound agent',
                'CRM sync (Follow Up Boss)',
                'Priority support',
              ]}
              onSignUp={openSignUp}
              delay="delay-300"
            />
          </div>
        </div>
      </section>

      {/* ────── FINAL CTA ────── */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <GridBackground />
        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[var(--text-primary)] mb-4 animate-fade-in-up">
            Ready to close more deals?
          </h2>
          <p className="text-lg text-[var(--text-secondary)] mb-8 animate-fade-in-up delay-100">
            Join 500+ agents who are automating their business with Estate AI. Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up delay-200">
            <button
              onClick={openSignUp}
              className="w-full sm:w-auto bg-[var(--primary)] text-white px-8 py-3 rounded-lg font-heading font-semibold hover:bg-[var(--primary-hover)] hover:shadow-lg transition-all shadow-sm text-sm"
            >
              Start for Free
            </button>
            <button
              onClick={openSignIn}
              className="w-full sm:w-auto bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] px-8 py-3 rounded-lg font-heading font-semibold hover:bg-[var(--surface-elevated)] transition-all text-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Theme toggle floating button */}
      <button
        onClick={toggleDark}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        title={dark ? 'Light Mode' : 'Dark Mode'}
      >
        <i className={`fas ${dark ? 'fa-sun' : 'fa-moon'}`} />
      </button>

      {/* Footer */}
      <Footer />
    </div>
  );
}
