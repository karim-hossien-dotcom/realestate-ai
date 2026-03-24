'use client'

import { useState, useEffect } from 'react'

type Comparable = {
  address: string
  sold_price: string
  sold_date: string
  sqft: number
  price_per_sqft: string
  notes: string
}

type CmaReport = {
  market_overview: string
  comparables: Comparable[]
  price_analysis: {
    low_estimate: string
    mid_estimate: string
    high_estimate: string
    price_per_sqft_range: string
    recommended_list_price: string
    reasoning: string
  }
  market_trends: string[]
  recommendations: string[]
  disclaimer: string
}

type Lead = {
  id: string
  owner_name: string
  property_address: string
  phone: string
  email: string
}

export default function CmaPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [form, setForm] = useState({
    property_address: '',
    property_type: 'commercial' as string,
    sqft: '',
    bedrooms: '',
    bathrooms: '',
    units: '',
    year_built: '',
    lot_size: '',
    condition: '' as string,
    owner_name: '',
    owner_price_expectation: '',
    additional_notes: '',
  })
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<CmaReport | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState('')

  // Fetch leads for the picker
  useEffect(() => {
    fetch('/api/leads?limit=200')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.leads) setLeads(data.leads)
      })
      .catch(console.error)
  }, [])

  // Auto-fill form when lead is selected
  const handleLeadSelect = (leadId: string) => {
    setSelectedLeadId(leadId)
    const lead = leads.find(l => l.id === leadId)
    if (lead) {
      setForm(prev => ({
        ...prev,
        property_address: lead.property_address || prev.property_address,
        owner_name: lead.owner_name || prev.owner_name,
      }))
    }
  }

  const handleGenerate = async () => {
    if (!form.property_address) {
      setError('Property address is required')
      return
    }

    setGenerating(true)
    setError('')
    setReport(null)

    try {
      const body: Record<string, unknown> = {
        property_address: form.property_address,
        property_type: form.property_type,
        owner_name: form.owner_name || undefined,
        owner_price_expectation: form.owner_price_expectation || undefined,
        additional_notes: form.additional_notes || undefined,
      }
      if (form.sqft) body.sqft = parseInt(form.sqft)
      if (form.bedrooms) body.bedrooms = parseInt(form.bedrooms)
      if (form.bathrooms) body.bathrooms = parseInt(form.bathrooms)
      if (form.units) body.units = parseInt(form.units)
      if (form.year_built) body.year_built = parseInt(form.year_built)
      if (form.lot_size) body.lot_size = form.lot_size
      if (form.condition) body.condition = form.condition

      const res = await fetch('/api/cma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.ok) {
        setReport(data.cma)
      } else {
        setError(data.error || 'Failed to generate CMA')
      }
    } catch {
      setError('Failed to generate CMA')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendEmail = async () => {
    const lead = leads.find(l => l.id === selectedLeadId)
    if (!lead?.email || !report) return

    setSending(true)
    setSendStatus('')

    try {
      const res = await fetch('/api/cma/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          email: lead.email,
          owner_name: form.owner_name,
          property_address: form.property_address,
          cma: report,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setSendStatus('sent')
      } else {
        setSendStatus('failed')
      }
    } catch {
      setSendStatus('failed')
    } finally {
      setSending(false)
    }
  }

  const selectedLead = leads.find(l => l.id === selectedLeadId)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">CMA Generator</h1>
        <p className="text-[var(--text-secondary)]">Generate a Comparative Market Analysis for any property</p>
      </div>

      {/* Lead Picker + Form */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Select a Lead (optional)</label>
          <select
            value={selectedLeadId}
            onChange={e => handleLeadSelect(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            <option value="">— Manual entry —</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>
                {l.owner_name || l.phone} — {l.property_address || 'No address'}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Property Address *</label>
            <input
              value={form.property_address}
              onChange={e => setForm(p => ({ ...p, property_address: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]"
              placeholder="123 Main St, Newark NJ"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Property Type</label>
            <select
              value={form.property_type}
              onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]"
            >
              <option value="commercial">Commercial</option>
              <option value="residential">Residential</option>
              <option value="multi-family">Multi-Family</option>
              <option value="industrial">Industrial</option>
              <option value="land">Land</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sqft</label>
            <input value={form.sqft} onChange={e => setForm(p => ({ ...p, sqft: e.target.value }))} type="number" className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]" placeholder="6000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{form.property_type === 'commercial' ? 'Units' : 'Beds'}</label>
            <input value={form.property_type === 'commercial' ? form.units : form.bedrooms} onChange={e => setForm(p => form.property_type === 'commercial' ? ({ ...p, units: e.target.value }) : ({ ...p, bedrooms: e.target.value }))} type="number" className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Year Built</label>
            <input value={form.year_built} onChange={e => setForm(p => ({ ...p, year_built: e.target.value }))} type="number" className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]" placeholder="2005" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Condition</label>
            <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))} className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]">
              <option value="">Unknown</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="needs-work">Needs Work</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Owner Name</label>
            <input value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]" placeholder="Ahmad Hassan" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Owner Price Expectation</label>
            <input value={form.owner_price_expectation} onChange={e => setForm(p => ({ ...p, owner_price_expectation: e.target.value }))} className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]" placeholder="$5M" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Additional Notes</label>
          <textarea value={form.additional_notes} onChange={e => setForm(p => ({ ...p, additional_notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] resize-none" placeholder="Corner lot, recently renovated, high foot traffic..." />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={generating || !form.property_address}
          className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating CMA...' : 'Generate CMA Report'}
        </button>
      </div>

      {/* CMA Report */}
      {report && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Comparative Market Analysis</h2>
                <p className="text-sm text-[var(--text-secondary)]">{form.property_address}</p>
                {form.owner_name && <p className="text-xs text-[var(--text-secondary)]">Prepared for {form.owner_name}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400">{report.price_analysis.recommended_list_price}</p>
                <p className="text-xs text-[var(--text-secondary)]">Recommended List Price</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{report.market_overview}</p>
          </div>

          {/* Price Analysis */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Price Analysis</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 rounded-lg bg-[var(--surface-elevated)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Low Estimate</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{report.price_analysis.low_estimate}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-xs text-emerald-400 mb-1">Recommended</p>
                <p className="text-xl font-bold text-emerald-400">{report.price_analysis.mid_estimate}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-[var(--surface-elevated)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">High Estimate</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{report.price_analysis.high_estimate}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Price per sqft: {report.price_analysis.price_per_sqft_range}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">{report.price_analysis.reasoning}</p>
          </div>

          {/* Comparables */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Comparable Sales</h3>
            <div className="space-y-3">
              {report.comparables.map((comp, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{comp.address}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{comp.notes}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{comp.sold_price}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{comp.sold_date} · {comp.sqft} sqft · {comp.price_per_sqft}/sqft</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trends + Recommendations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Market Trends</h3>
              <ul className="space-y-2">
                {report.market_trends.map((trend, i) => (
                  <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2">
                    <span className="text-emerald-400 flex-shrink-0">+</span>
                    {trend}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-[var(--text-secondary)] italic px-2">{report.disclaimer}</p>

          {/* Actions */}
          <div className="flex gap-3">
            {selectedLead?.email && (
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex-1 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium rounded-lg border border-blue-500/20 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : sendStatus === 'sent' ? 'Sent!' : `Email to ${selectedLead.email}`}
              </button>
            )}
            <button
              onClick={() => {
                const text = `CMA Report — ${form.property_address}\n\nRecommended Price: ${report.price_analysis.recommended_list_price}\nRange: ${report.price_analysis.low_estimate} - ${report.price_analysis.high_estimate}\n\n${report.market_overview}\n\nComps:\n${report.comparables.map(c => `• ${c.address}: ${c.sold_price} (${c.sold_date})`).join('\n')}`
                navigator.clipboard.writeText(text)
              }}
              className="px-6 py-3 bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] font-medium rounded-lg border border-[var(--border)] transition-colors"
            >
              Copy as Text
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
