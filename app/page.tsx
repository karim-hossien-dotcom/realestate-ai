'use client';

// Purpose: Estate AI landing page — dark premium CRM for commercial real estate
// Tone: Linear meets Antimetal — dark, sharp, premium, technical
// Reference: Linear.app, Antimetal.com, CallSine.com
// Differentiator: The animated gradient orb + metric proof wall

import Link from 'next/link';
import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { Footer } from './components/Footer';

/* ═══════════════════════════════════════════════════════════
   AUTH MODAL — preserved from original, fully functional
   ═══════════════════════════════════════════════════════════ */

function AuthModal({
  isOpen, onClose, initialTab,
}: { isOpen: boolean; onClose: () => void; initialTab: 'signin' | 'signup' }) {
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

  useEffect(() => { if (isOpen) { setActiveTab(initialTab); setError(null); setShowForgotPassword(false); } }, [isOpen, initialTab]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; if (isOpen) window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [isOpen, onClose]);
  useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [isOpen]);

  if (!isOpen) return null;

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({ email: fd.get('email') as string, password: fd.get('password') as string });
        if (error) setError(error.message); else { router.push('/dashboard'); router.refresh(); }
      } catch { setError('An unexpected error occurred.'); }
    });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email: fd.get('email') as string, password: fd.get('password') as string,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { full_name: `${fd.get('firstName')} ${fd.get('lastName')}`.trim(), company: fd.get('company') as string } },
        });
        if (error) setError(error.message); else if (data.user && !data.session) setError('Check your email to confirm your account.'); else { router.push('/dashboard'); router.refresh(); }
      } catch { setError('An unexpected error occurred.'); }
    });
  }

  const inputCls = "block w-full px-3.5 py-2.5 bg-[#0A0A0F] border border-white/10 rounded-lg text-white placeholder:text-white/30 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 transition-colors outline-none";
  const labelCls = "block text-sm font-medium text-white/70 mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div ref={modalRef} className="relative w-full max-w-md bg-[#111118] rounded-2xl shadow-2xl border border-white/10 overflow-y-auto max-h-[90vh]" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white transition-colors z-10 cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div className="p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
            </div>
            <span className="text-lg font-bold text-white">Estate AI</span>
          </div>
          <div className="flex border-b border-white/10 mb-6">
            {(['signin', 'signup'] as const).map(t => (
              <button key={t} className={`flex-1 py-2.5 text-center border-b-2 text-sm font-medium transition-colors cursor-pointer ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-white/40 hover:text-white/60'}`}
                onClick={() => { setActiveTab(t); setError(null); setShowForgotPassword(false); }}>
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">{error}</div>}

          {activeTab === 'signin' && (
            <div className="space-y-5">
              <div><h2 className="text-2xl font-bold text-white">Welcome back</h2><p className="text-sm text-white/40 mt-1">Sign in to continue</p></div>
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div><label htmlFor="si-email" className={labelCls}>Email</label><input id="si-email" name="email" type="email" required disabled={isPending} className={inputCls} placeholder="you@example.com" /></div>
                <div>
                  <label htmlFor="si-pass" className={labelCls}>Password</label>
                  <div className="relative">
                    <input id="si-pass" name="password" type={showPassword ? 'text' : 'password'} required disabled={isPending} className={inputCls} placeholder="Enter your password" />
                    <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowPassword(p => !p)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 hover:text-white/60"><path d={showPassword ? "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"}/>{!showPassword && <circle cx="12" cy="12" r="3"/>}</svg>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setShowForgotPassword(true); setError(null); setForgotSent(false); }} className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer">Forgot password?</button>
                </div>
                {showForgotPassword && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                    {forgotSent ? (
                      <div className="text-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className="mx-auto mb-2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                        <p className="text-sm text-white font-medium">Reset link sent!</p>
                        <p className="text-xs text-white/40 mt-1">Check your email.</p>
                        <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }} className="text-sm text-blue-400 mt-3 cursor-pointer">Back to sign in</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-white/50">Enter your email to receive a reset link.</p>
                        <div className="flex gap-2">
                          <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your@email.com" className={`${inputCls} flex-1`} />
                          <button type="button" disabled={forgotLoading || !forgotEmail} onClick={async () => {
                            setForgotLoading(true); setError(null);
                            try { const supabase = createClient(); const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo: `${window.location.origin}/reset-password` }); if (error) setError(error.message); else setForgotSent(true); } catch { setError('Failed to send reset email'); } finally { setForgotLoading(false); }
                          }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors cursor-pointer">
                            {forgotLoading ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                        <button type="button" onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }} className="text-xs text-white/30 hover:text-white/50 cursor-pointer">Cancel</button>
                      </>
                    )}
                  </div>
                )}
                <button type="submit" disabled={isPending} className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  {isPending ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'signup' && (
            <div className="space-y-5">
              <div><h2 className="text-2xl font-bold text-white">Create your account</h2><p className="text-sm text-white/40 mt-1">Start your 14-day free trial</p></div>
              <form className="space-y-4" onSubmit={handleSignUp}>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="su-fn" className={labelCls}>First name</label><input id="su-fn" name="firstName" type="text" required disabled={isPending} className={inputCls} placeholder="John" /></div>
                  <div><label htmlFor="su-ln" className={labelCls}>Last name</label><input id="su-ln" name="lastName" type="text" required disabled={isPending} className={inputCls} placeholder="Smith" /></div>
                </div>
                <div><label htmlFor="su-email" className={labelCls}>Email</label><input id="su-email" name="email" type="email" required disabled={isPending} className={inputCls} placeholder="you@example.com" /></div>
                <div><label htmlFor="su-co" className={labelCls}>Company / Agency</label><input id="su-co" name="company" type="text" disabled={isPending} className={inputCls} placeholder="Real Estate Company" /></div>
                <div><label htmlFor="su-pass" className={labelCls}>Password</label><input id="su-pass" name="password" type="password" required minLength={8} disabled={isPending} className={inputCls} placeholder="Min. 8 characters" /></div>
                <div className="flex items-start">
                  <input id="su-terms" type="checkbox" required className="h-4 w-4 bg-transparent border-white/20 rounded mt-0.5 accent-blue-500" />
                  <label htmlFor="su-terms" className="ml-2 text-sm text-white/40">I agree to the <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms</Link> and <Link href="/privacy-policy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link></label>
                </div>
                <button type="submit" disabled={isPending} className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
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

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════════ */

const FEATURES = [
  { icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', title: 'Multi-Channel Outreach', desc: 'WhatsApp, SMS, and Email from one dashboard. AI personalizes every message to your lead\'s context.' },
  { icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', title: 'AI Lead Scoring', desc: 'Every lead gets a 0-100 score based on engagement, intent, and response patterns. Focus on what closes.' },
  { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Automated Follow-Ups', desc: 'AI generates and schedules follow-ups at the perfect time. Never lose a deal to silence.' },
  { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', title: '24/7 AI Agent', desc: 'Your inbound agent qualifies leads, handles objections, and books meetings around the clock.' },
  { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', title: 'Smart Calendar', desc: 'Sync with Google or Apple Calendar. AI books directly into your availability — no back and forth.' },
  { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Real-Time Analytics', desc: 'Track campaigns, conversion rates, and agent productivity. See what\'s working instantly.' },
];

const PLANS = [
  { name: 'Starter', price: 99, features: ['Up to 250 leads', '750 messages/mo', 'AI lead scoring', 'Email campaigns', 'Basic analytics', '1 user'] },
  { name: 'Pro', price: 249, popular: true, features: ['Up to 1,000 leads', '3,000 messages/mo', 'WhatsApp + SMS + Email', 'AI follow-ups & auto-reply', 'CRM integration', 'Up to 5 users'] },
  { name: 'Agency', price: 499, features: ['Unlimited leads', '15,000 messages/mo', 'All channels + AI agent', 'Team management', 'Custom integrations', 'Up to 15 users'] },
];

export default function LandingPage() {
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: 'signin' | 'signup' }>({ open: false, tab: 'signin' });

  useEffect(() => {
    // Force dark mode on landing page
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  const openSignIn = () => setAuthModal({ open: true, tab: 'signin' });
  const openSignUp = () => setAuthModal({ open: true, tab: 'signup' });

  return (
    <div className="min-h-screen bg-[#07070A] text-white selection:bg-blue-500/30 overflow-x-hidden">
      {/* ── Ambient gradient orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/6 rounded-full blur-[100px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#07070A]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Estate AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'How It Works', 'Pricing'].map(s => (
              <a key={s} href={`#${s.toLowerCase().replace(/ /g, '-')}`} className="text-[13px] text-white/40 hover:text-white/80 transition-colors">{s}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openSignIn} className="text-[13px] text-white/50 hover:text-white transition-colors px-3 py-1.5 cursor-pointer">Sign In</button>
            <button onClick={openSignUp} className="text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg transition-colors cursor-pointer">Get Started</button>
          </div>
        </div>
      </nav>

      <AuthModal isOpen={authModal.open} onClose={() => setAuthModal({ ...authModal, open: false })} initialTab={authModal.tab} />

      {/* ══════ HERO ══════ */}
      <section className="relative pt-40 pb-24 sm:pt-48 sm:pb-32">
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Pill */}
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 mb-8" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[13px] text-white/50">Now with GPT-4o powered conversations</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>
            <span className="text-white">Your AI agent for</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">real estate deals</span>
          </h1>

          {/* Sub */}
          <p className="text-lg sm:text-xl text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
            Automate lead outreach across WhatsApp, SMS, and Email.
            AI qualifies leads, handles objections, and books meetings — so you can focus on closing.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3" style={{ animation: 'fadeInUp 0.6s ease-out 0.3s both' }}>
            <button onClick={openSignUp} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/25 text-sm cursor-pointer">
              Start Free Trial
            </button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-white/[0.04] border border-white/[0.08] text-white/70 px-8 py-3.5 rounded-xl font-semibold hover:bg-white/[0.08] hover:text-white transition-all text-sm cursor-pointer">
              See How It Works
            </button>
          </div>

          {/* Proof */}
          <div className="mt-16 flex items-center justify-center gap-8 text-center" style={{ animation: 'fadeInUp 0.6s ease-out 0.4s both' }}>
            {[['10K+', 'Leads managed'], ['50K+', 'AI messages sent'], ['40%', 'More conversions'], ['15hrs', 'Saved per week']].map(([v, l]) => (
              <div key={l} className="hidden sm:block">
                <p className="text-2xl font-bold text-white">{v}</p>
                <p className="text-xs text-white/30 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything to close more deals</h2>
            <p className="text-white/35 max-w-lg mx-auto">From lead capture to appointment booking — one platform, fully automated.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 cursor-default"
                style={{ animation: `fadeInUp 0.5s ease-out ${0.1 * i}s both` }}>
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/15 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon}/></svg>
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-[13px] text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-24 sm:py-32 border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">From lead to close in 3 steps</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { n: '01', t: 'Import Leads', d: 'Upload a CSV or sync from Follow Up Boss. AI auto-maps fields and deduplicates.', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
              { n: '02', t: 'Launch Campaign', d: 'Pick a channel, choose your leads. AI writes personalized messages based on each lead\'s context.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { n: '03', t: 'AI Closes the Loop', d: 'Inbound AI agent handles replies 24/7 — qualifies, overcomes objections, and books meetings.', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
            ].map((s, i) => (
              <div key={s.n} className="text-center" style={{ animation: `fadeInUp 0.5s ease-out ${0.15 * i}s both` }}>
                <div className="w-14 h-14 mx-auto bg-white/[0.04] border border-white/[0.08] rounded-2xl flex items-center justify-center mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}/></svg>
                </div>
                <span className="inline-block text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full mb-3">{s.n}</span>
                <h3 className="text-[15px] font-semibold text-white mb-2">{s.t}</h3>
                <p className="text-[13px] text-white/35 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PRICING ══════ */}
      <section id="pricing" className="py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-[0.2em] mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
            <p className="text-white/35">Start with a 14-day free trial. No credit card required.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {PLANS.map((plan, i) => (
              <div key={plan.name} className={`relative rounded-2xl p-6 transition-all duration-300 cursor-default ${
                plan.popular
                  ? 'bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/30 ring-1 ring-blue-500/20'
                  : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]'
              }`} style={{ animation: `fadeInUp 0.5s ease-out ${0.1 * i}s both` }}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-semibold px-3 py-0.5 rounded-full">Most Popular</div>
                )}
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{plan.name}</h3>
                <div className="mt-3 mb-5">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-sm text-white/30">/mo</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-white/40">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? '#3b82f6' : '#4ade80'} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={openSignUp} className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-white/[0.06] text-white/70 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white'
                }`}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="py-24 sm:py-32 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to close more deals?</h2>
          <p className="text-lg text-white/35 mb-10 max-w-xl mx-auto">
            Join agents who are automating their outreach, qualifying leads faster, and booking more meetings with AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={openSignUp} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/25 text-sm cursor-pointer">
              Start Free Trial
            </button>
            <button onClick={openSignIn} className="w-full sm:w-auto bg-white/[0.04] border border-white/[0.08] text-white/70 px-8 py-3.5 rounded-xl font-semibold hover:bg-white/[0.08] hover:text-white transition-all text-sm cursor-pointer">
              Sign In
            </button>
          </div>
        </div>
      </section>

      <Footer />

      {/* ── Global animation keyframes ── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
