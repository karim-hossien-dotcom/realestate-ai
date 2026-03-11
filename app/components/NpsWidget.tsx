'use client'

import { useState, useEffect } from 'react'

type Step = 'hidden' | 'score' | 'feedback' | 'thanks'

const SCORE_COLORS: Record<string, string> = {
  detractor: 'bg-red-500/80 hover:bg-red-500',
  passive: 'bg-amber-500/80 hover:bg-amber-500',
  promoter: 'bg-emerald-500/80 hover:bg-emerald-500',
}

function getScoreCategory(score: number) {
  if (score <= 6) return 'detractor'
  if (score <= 8) return 'passive'
  return 'promoter'
}

export default function NpsWidget() {
  const [step, setStep] = useState<Step>('hidden')
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Check localStorage first for quick dismiss
    const dismissed = localStorage.getItem('nps_dismissed')
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime()
      if (Date.now() - dismissedAt < 14 * 24 * 60 * 60 * 1000) return
    }

    // Check server-side eligibility after 3s delay
    const timer = setTimeout(() => {
      fetch('/api/feedback/nps')
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.showNps) {
            setStep('score')
          }
        })
        .catch(() => {})
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = async () => {
    localStorage.setItem('nps_dismissed', new Date().toISOString())
    setStep('hidden')
    try {
      await fetch('/api/feedback/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, pageUrl: window.location.pathname }),
      })
    } catch { /* best effort */ }
  }

  const handleScoreSelect = (s: number) => {
    setScore(s)
    setStep('feedback')
  }

  const handleSubmit = async () => {
    if (score === null) return
    setSubmitting(true)
    try {
      await fetch('/api/feedback/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          feedback: feedback.trim() || undefined,
          pageUrl: window.location.pathname,
        }),
      })
      setStep('thanks')
      setTimeout(() => setStep('hidden'), 3000)
    } catch {
      setStep('hidden')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'hidden') return null

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[340px] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="h-0.5 bg-gradient-to-r from-[var(--primary)] to-emerald-400" />
      <div className="p-4">
        {step === 'score' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">How likely are you to recommend Estate AI?</span>
              <button onClick={handleDismiss} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer">
                Later
              </button>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => handleScoreSelect(i)}
                  className={`flex-1 py-2 rounded-md text-xs font-bold text-white transition-all cursor-pointer ${SCORE_COLORS[getScoreCategory(i)]}`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[var(--text-secondary)]">Not likely</span>
              <span className="text-[10px] text-[var(--text-secondary)]">Very likely</span>
            </div>
          </>
        )}

        {step === 'feedback' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Thanks!</span>
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${SCORE_COLORS[getScoreCategory(score!)]?.split(' ')[0]}`}>
                  {score}/10
                </span>
              </div>
              <button onClick={handleDismiss} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer">
                Skip
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-2">Any feedback to share? (optional)</p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="What could we improve?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-2 w-full py-2 rounded-lg text-sm font-semibold bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </>
        )}

        {step === 'thanks' && (
          <div className="py-4 text-center">
            <div className="text-2xl mb-2">🙏</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">Thank you for your feedback!</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Your input helps us improve Estate AI.</div>
          </div>
        )}
      </div>
    </div>
  )
}
