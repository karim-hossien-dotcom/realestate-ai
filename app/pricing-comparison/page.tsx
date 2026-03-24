// Purpose: Public competitor pricing comparison — no login required
// Tone: Dark premium — same visual language as the landing page
// Reference: Linear.app, Stripe pricing pages
// Differentiator: The only table in real estate CRM that makes Estate AI's cost advantage undeniable at a glance

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM Pricing Comparison — Estate AI vs Follow Up Boss, kvCORE & More',
  description:
    'See how Estate AI compares to Follow Up Boss, kvCORE, Lofty, Sierra Interactive, and CINC on price, WhatsApp, AI agents, and data privacy.',
  openGraph: {
    title: 'Real Estate CRM Pricing Comparison 2026',
    description:
      'Estate AI starts at $99/mo with WhatsApp built in. No hidden fees. No per-user gotchas.',
    url: 'https://realestate-ai.app/pricing-comparison',
  },
};

type Verdict = 'yes' | 'no' | 'partial' | 'dead';

interface Competitor {
  name: string;
  price: string;
  priceNote?: string;
  whatsapp: Verdict;
  aiAgent: Verdict;
  transparentPricing: Verdict;
  dataPrivacy: Verdict;
  badge?: string;
}

const COMPETITORS: Competitor[] = [
  {
    name: 'Estate AI',
    price: '$99 – $499 / mo',
    priceNote: 'Flat rate, no per-user fees',
    whatsapp: 'yes',
    aiAgent: 'yes',
    transparentPricing: 'yes',
    dataPrivacy: 'yes',
    badge: 'Best Value',
  },
  {
    name: 'Follow Up Boss',
    price: '$58 – $833 / mo',
    priceNote: 'Per-user pricing stacks fast',
    whatsapp: 'no',
    aiAgent: 'partial',
    transparentPricing: 'partial',
    dataPrivacy: 'no',
  },
  {
    name: 'kvCORE',
    price: '$499 – $1,800 / mo',
    priceNote: 'Quote-only + $500–$1,000 setup fee',
    whatsapp: 'no',
    aiAgent: 'partial',
    transparentPricing: 'no',
    dataPrivacy: 'partial',
  },
  {
    name: 'Lofty (Chime)',
    price: 'Opaque — call required',
    priceNote: 'Hidden add-on fees after signup',
    whatsapp: 'no',
    aiAgent: 'partial',
    transparentPricing: 'no',
    dataPrivacy: 'partial',
  },
  {
    name: 'Sierra Interactive',
    price: '$360 – $725 / mo',
    priceNote: '+ ad management fees on top',
    whatsapp: 'no',
    aiAgent: 'partial',
    transparentPricing: 'partial',
    dataPrivacy: 'yes',
  },
  {
    name: 'CINC',
    price: '$899+ / mo',
    priceNote: 'Enterprise contracts, long lock-in',
    whatsapp: 'no',
    aiAgent: 'partial',
    transparentPricing: 'no',
    dataPrivacy: 'partial',
  },
  {
    name: 'LionDesk',
    price: 'Discontinued',
    priceNote: 'Shut down September 2025',
    whatsapp: 'no',
    aiAgent: 'no',
    transparentPricing: 'no',
    dataPrivacy: 'no',
    badge: 'Discontinued',
  },
];

function VerdictCell({ value }: { value: Verdict }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-sm">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Yes
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-sm">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="10.5" r="0.75" fill="currentColor" />
        </svg>
        Partial
      </span>
    );
  }
  if (value === 'dead') {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-500 font-medium text-sm">
        — Discontinued
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-400 font-medium text-sm">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
        <path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      No
    </span>
  );
}

const COLUMNS = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'aiAgent', label: 'AI Agent 24/7' },
  { key: 'transparentPricing', label: 'Transparent Pricing' },
  { key: 'dataPrivacy', label: 'Data Privacy' },
] as const;

export default function PricingComparisonPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: '#07070A' }}
    >
      {/* Ambient gradient */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-14 text-center">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Estate AI
          </Link>

          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl"
            style={{ letterSpacing: '-0.02em' }}
          >
            Real Estate CRM Pricing
            <br />
            <span style={{ color: '#818cf8' }}>Compared Honestly</span>
          </h1>
          <p className="mx-auto max-w-xl text-base text-zinc-400">
            No sales call required. Here is how Estate AI stacks up against the tools agents are leaving in 2026 — on price, WhatsApp, AI, and data ownership.
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">CRM</th>
                <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Starting Price</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-4 py-4 text-center font-medium text-zinc-500 uppercase tracking-wider text-xs">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((crm, idx) => {
                const isEstate = crm.name === 'Estate AI';
                const isDead = crm.badge === 'Discontinued';
                return (
                  <tr
                    key={crm.name}
                    className={[
                      'border-b border-white/[0.04] transition-colors',
                      isEstate
                        ? 'bg-indigo-500/[0.07] hover:bg-indigo-500/[0.10]'
                        : isDead
                        ? 'opacity-50 hover:opacity-60'
                        : 'hover:bg-white/[0.02]',
                      idx === COMPETITORS.length - 1 ? 'border-b-0' : '',
                    ].join(' ')}
                  >
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${isEstate ? 'text-white' : 'text-zinc-300'}`}>
                          {crm.name}
                        </span>
                        {crm.badge && !isDead && (
                          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                            {crm.badge}
                          </span>
                        )}
                        {isDead && (
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Discontinued
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4">
                      <div className={`font-medium ${isEstate ? 'text-white' : 'text-zinc-300'}`}>
                        {crm.price}
                      </div>
                      {crm.priceNote && (
                        <div className="mt-0.5 text-xs text-zinc-500">{crm.priceNote}</div>
                      )}
                    </td>

                    {/* Feature columns */}
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="px-4 py-4 text-center">
                        <VerdictCell value={crm[col.key]} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Source note */}
        <p className="mt-4 text-center text-xs text-zinc-600">
          Pricing sourced from G2, Capterra, and vendor sites. Verified March 2026. Follow Up Boss pricing reflects post-Zillow acquisition tiers.
        </p>

        {/* Key differentiators */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'WhatsApp Native',
              copy: 'The only real estate CRM built on the Meta WhatsApp Business API. No bolt-on. No third-party middleware.',
            },
            {
              label: 'No Data Sharing',
              copy: 'Your leads are yours. We do not sell, share, or cross-reference your contacts with listing portals or lead aggregators.',
            },
            {
              label: 'Flat-Rate Pricing',
              copy: 'Three tiers. No per-user fees. No annual lock-in. No surprise invoice at month-end. Cancel anytime.',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/[0.06] p-5"
              style={{ background: 'rgba(255,255,255,0.025)' }}
            >
              <div className="mb-2 text-sm font-semibold text-white">{item.label}</div>
              <div className="text-sm leading-relaxed text-zinc-400">{item.copy}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="mb-6 text-zinc-400 text-sm">
            Starter plan at $99/mo. Full AI automation on Pro at $249/mo. No credit card required to explore.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}
          >
            Start Free — No Card Required
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="mt-4 text-xs text-zinc-600">
            Starter $99 / mo &nbsp;·&nbsp; Pro $249 / mo &nbsp;·&nbsp; Agency $499 / mo
          </div>
        </div>

      </div>
    </main>
  );
}
