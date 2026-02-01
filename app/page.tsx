'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showSigninPassword, setShowSigninPassword] = useState(false);

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

          {/* Tabs */}
          <div id="auth-tabs" className="flex border-b border-gray-200 mb-8">
            <button
              id="signin-tab"
              className={`flex-1 py-3 px-1 text-center border-b-2 font-medium ${
                activeTab === 'signin'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('signin')}
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
              onClick={() => setActiveTab('signup')}
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

              <form className="space-y-6" method="post" action="/signin">
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
                      type="email"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                      type={showSigninPassword ? 'text' : 'password'}
                      required
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                  <a
                    href="#"
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Sign In
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
                <button className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <i className="fab fa-google text-red-500 mr-2" />
                  Google
                </button>
                <button className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <i className="fab fa-microsoft text-blue-600 mr-2" />
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

              <form className="space-y-6">
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
                      type="text"
                      required
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                      type="text"
                      required
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                      type="email"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                    type="text"
                    className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                      type="password"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
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
                    <a href="#" className="text-primary hover:text-primary/80">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-primary hover:text-primary/80">
                      Privacy Policy
                    </a>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Create Account
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
                <button className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <i className="fab fa-google text-red-500 mr-2" />
                  Google
                </button>
                <button className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <i className="fab fa-microsoft text-blue-600 mr-2" />
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
