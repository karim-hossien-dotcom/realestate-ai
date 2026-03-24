import { createServiceClient } from '@/app/lib/supabase/server'
import { getStripe } from '@/app/lib/billing/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/**
 * Overage billing rates — charged per unit over plan quota.
 * Tracked in usage_records, billed via Stripe invoice items on invoice.created.
 */
export const OVERAGE_RATES = {
  sms: { rate: 5, currency: 'usd', label: 'SMS Overage', description: 'Additional SMS messages' },
  email: { rate: 2, currency: 'usd', label: 'Email Overage', description: 'Additional email messages' },
  whatsapp: { rate: 8, currency: 'usd', label: 'WhatsApp Overage', description: 'Additional WhatsApp messages' },
  leads: { rate: 15, currency: 'usd', label: 'Lead Overage', description: 'Additional leads beyond plan limit' },
} as const

type OverageChannel = keyof typeof OVERAGE_RATES

const OVERAGE_COLUMN_MAP: Record<OverageChannel, string> = {
  sms: 'overage_sms',
  email: 'overage_email',
  whatsapp: 'overage_whatsapp',
  leads: 'overage_leads',
}

/**
 * Record an overage for a given user/channel/period.
 * Upserts into usage_records, incrementing the appropriate overage counter.
 */
export async function recordOverage(
  userId: string,
  channel: OverageChannel,
  periodStart: string,
  count: number = 1,
): Promise<void> {
  const supabase: SupabaseClient = createServiceClient()
  const column = OVERAGE_COLUMN_MAP[channel]

  // Try to find existing record for this user + period
  const { data: existing } = await supabase
    .from('usage_records')
    .select('id, ' + column)
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .limit(1)
    .single()

  if (existing) {
    // Increment the overage counter
    const currentVal = existing[column] || 0
    await supabase
      .from('usage_records')
      .update({ [column]: currentVal + count })
      .eq('id', existing.id)
  } else {
    // Create new usage record for this period
    await supabase
      .from('usage_records')
      .insert({
        user_id: userId,
        period_start: periodStart,
        [column]: count,
        overage_reported: false,
      })
  }
}

/**
 * Add overage line items to a Stripe invoice.
 * Called from the invoice.created webhook handler.
 * Returns the number of line items added.
 */
export async function addOverageLineItems(
  stripeCustomerId: string,
  invoiceId: string,
  userId: string,
  periodStart: string,
): Promise<number> {
  const supabase: SupabaseClient = createServiceClient()

  // Get unreported overages for this user + period
  const { data: record } = await supabase
    .from('usage_records')
    .select('*')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .eq('overage_reported', false)
    .limit(1)
    .single()

  if (!record) return 0

  const stripe = getStripe()
  let itemsAdded = 0

  // Add line items for each channel with overages
  for (const [channel, config] of Object.entries(OVERAGE_RATES)) {
    const col = OVERAGE_COLUMN_MAP[channel as OverageChannel]
    const qty = record[col] || 0

    if (qty > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: invoiceId,
        amount: qty * config.rate,
        currency: config.currency,
        description: `${config.description} (${qty} × $${(config.rate / 100).toFixed(2)})`,
      })
      itemsAdded++
    }
  }

  // Mark as reported
  if (itemsAdded > 0) {
    await supabase
      .from('usage_records')
      .update({
        stripe_invoice_id: invoiceId,
        overage_reported: true,
      })
      .eq('id', record.id)
  }

  return itemsAdded
}
