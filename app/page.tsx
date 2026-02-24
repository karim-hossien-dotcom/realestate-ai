'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const router = useRouter();

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    startTransition(async () => {
      try {
        console.log('[Auth] Attempting sign in for:', email);
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('[Auth] Sign in result:', { data, error });

        if (error) {
          console.error('[Auth] Sign in error:', error);
          setError(error.message);
        } else {
          console.log('[Auth] Sign in successful, redirecting...');
          router.push('/prototype');
          router.refresh();
        }
      } catch (err) {
        console.error('[Auth] Unexpected error:', err);
        setError('An unexpected error occurred. Check the console for details.');
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
        console.log('[Auth] Attempting sign up for:', email);
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: `${firstName} ${lastName}`.trim(),
              company,
            },
          },
        });
        console.log('[Auth] Sign up result:', { data, error });

        if (error) {
          console.error('[Auth] Sign up error:', error);
          setError(error.message);
        } else if (data.user && !data.session) {
          // Email confirmation required
          setError('Check your email to confirm your account before signing in.');
        } else {
          console.log('[Auth] Sign up successful, redirecting...');
          router.push('/prototype');
          router.refresh();
        }
      } catch (err) {
        console.error('[Auth] Unexpected error:', err);
        setError('An unexpected error occurred. Check the console for details.');
      }
    });
  }

  return (
    <div className="bg-gray-50 min-h-screen flex">
      {/* LEFT PANEL (desktop only) */}
      <div
        id="auth-left-panel"
        className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-blue-800" />
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <i className="fas fa-home text-primary text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">RealEstate AI</h1>
                <p className="text-blue-200">Agent Assistant</p>
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold text-white mb-6">
              Streamline Your Real Estate Business
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Automate lead management, SMS follow-ups, and appointment scheduling with our powerful
              AI-driven platform.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                  <i className="fas fa-check text-white text-xs" />
                </div>
                <span className="text-blue-100">Automated SMS campaigns &amp; follow-ups</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                  <i className="fas fa-check text-white text-xs" />
                </div>
                <span className="text-blue-100">Lead management &amp; conversation tracking</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                  <i className="fas fa-check text-white text-xs" />
                </div>
                <span className="text-blue-100">Compliance monitoring &amp; A2P registration</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                  <i className="fas fa-check text-white text-xs" />
                </div>
                <span className="text-blue-100">
                  Calendar integration &amp; appointment scheduling
                </span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-12 right-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center space-x-4 mb-4">
                <img
                  src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg"
                  alt="Sarah"
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <p className="text-white font-medium">Sarah Thompson</p>
                  <p className="text-blue-200 text-sm">Top Performing Agent</p>
                </div>
              </div>
              <p className="text-blue-100 italic">
                &quot;RealEstate AI transformed my business. I&apos;ve increased my lead conversion
                by 40% and saved 15 hours per week on follow-ups.&quot;
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (auth forms) */}
      <div
        id="auth-right-panel"
        className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16"
      >
        <div className="mx-auto w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-home text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RealEstate AI</h1>
                <p className="text-sm text-gray-500">Agent Assistant</p>
              </div>
            </div>
          </div>

          <div className="mb-6 flex justify-center lg:justify-start">
            <Link
              href="/prototype"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              View Prototype
            </Link>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div id="auth-tabs" className="flex border-b border-gray-200 mb-8">
            <button
              id="signin-tab"
              className={`flex-1 py-3 px-1 text-center border-b-2 font-medium ${
                activeTab === 'signin'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => { setActiveTab('signin'); setError(null); }}
            >
              Sign In
            </button>
            <button
              id="signup-tab"
              className={`flex-1 py-3 px-1 text-center border-b-2 font-medium ${
                activeTab === 'signup'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => { setActiveTab('signup'); setError(null); }}
            >
              Sign Up
            </button>
          </div>

          {/* SIGN IN FORM */}
          {activeTab === 'signin' && (
            <div id="signin-form" className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-600">Sign in to your account to continue</p>
              </div>

              <form className="space-y-6" onSubmit={handleSignIn}>
                <div>
                  <label
                    htmlFor="signin-email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-envelope text-gray-400" />
                    </div>
                    <input
                      id="signin-email"
                      name="email"
                      type="email"
                      required
                      disabled={isPending}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signin-password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-gray-400" />
                    </div>
                    <input
                      id="signin-password"
                      name="password"
                      type={showSigninPassword ? 'text' : 'password'}
                      required
                      disabled={isPending}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowSigninPassword((prev) => !prev)}
                    >
                      <i
                        className={`fas ${
                          showSigninPassword ? 'fa-eye-slash' : 'fa-eye'
                        } text-gray-400 hover:text-gray-600`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label
                      htmlFor="remember-me"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setError(null); setForgotSent(false); }}
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Forgot Password Inline Form */}
                {showForgotPassword && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    {forgotSent ? (
                      <div className="text-center">
                        <i className="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
                        <p className="text-sm text-gray-700 font-medium">Reset link sent!</p>
                        <p className="text-xs text-gray-500 mt-1">Check your email for a password reset link.</p>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}
                          className="text-sm text-primary mt-3 hover:text-primary/80"
                        >
                          Back to sign in
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">Enter your email to receive a reset link.</p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary text-gray-900 bg-white"
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
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {forgotLoading ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                          className="text-xs text-gray-500 hover:text-gray-700"
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
                  className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button disabled title="Coming soon" className="w-full inline-flex justify-center py-3 px-4 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">
                  <i className="fab fa-google text-gray-400 mr-2" />
                  Google
                </button>
                <button disabled title="Coming soon" className="w-full inline-flex justify-center py-3 px-4 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">
                  <i className="fab fa-microsoft text-gray-400 mr-2" />
                  Microsoft
                </button>
              </div>
            </div>
          )}

          {/* SIGN UP FORM */}
          {activeTab === 'signup' && (
            <div id="signup-form" className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Create your account
                </h2>
                <p className="text-gray-600">Start your 14-day free trial today</p>
              </div>

              <form className="space-y-6" onSubmit={handleSignUp}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="first-name"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      First name
                    </label>
                    <input
                      id="first-name"
                      name="firstName"
                      type="text"
                      required
                      disabled={isPending}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="last-name"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Last name
                    </label>
                    <input
                      id="last-name"
                      name="lastName"
                      type="text"
                      required
                      disabled={isPending}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-envelope text-gray-400" />
                    </div>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      disabled={isPending}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Company/Agency
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    disabled={isPending}
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                    placeholder="Real Estate Company"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-gray-400" />
                    </div>
                    <input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      disabled={isPending}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-100 text-gray-900 bg-white"
                      placeholder="Create a password"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Must be at least 8 characters with numbers and letters
                  </p>
                </div>

                <div className="flex items-start">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1"
                  />
                  <label
                    htmlFor="terms"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    I agree to the{' '}
                    <Link href="/terms" className="text-primary hover:text-primary/80">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy" className="text-primary hover:text-primary/80">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">
                    Or sign up with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button disabled title="Coming soon" className="w-full inline-flex justify-center py-3 px-4 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">
                  <i className="fab fa-google text-gray-400 mr-2" />
                  Google
                </button>
                <button disabled title="Coming soon" className="w-full inline-flex justify-center py-3 px-4 border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">
                  <i className="fab fa-microsoft text-gray-400 mr-2" />
                  Microsoft
                </button>
              </div>
            </div>
          )}

          {/* Features strip */}
          <div id="auth-features" className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Why choose RealEstate AI?
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-robot text-primary text-sm" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">AI-Powered Automation</p>
                  <p className="text-sm text-gray-500">
                    Smart lead scoring and automated follow-ups
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-shield-alt text-green-600 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Compliance Ready</p>
                  <p className="text-sm text-gray-500">
                    Built-in A2P registration and monitoring
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-purple-600 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Performance Analytics</p>
                  <p className="text-sm text-gray-500">
                    Track campaigns and optimize conversion rates
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
