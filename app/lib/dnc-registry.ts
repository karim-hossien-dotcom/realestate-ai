/**
 * National DNC (Do Not Call) Registry scrubbing.
 *
 * The FTC National DNC list must be downloaded from https://telemarketing.donotcall.gov/
 * after registering your Subscription Access Number (SAN) and paying the annual fee.
 *
 * Once downloaded, phone numbers should be loaded into the `national_dnc` table
 * via the /api/admin/dnc-import endpoint or a migration script.
 *
 * This module provides the check function used before outbound SMS/voice campaigns.
 */

import { createServiceClient } from '@/app/lib/supabase/server';

/**
 * Normalize a phone number to 10-digit US format for DNC matching.
 * The FTC DNC list stores numbers as 10-digit (no country code).
 */
function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Strip leading 1 if 11 digits (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Check a single phone number against the National DNC Registry.
 * Returns true if the number is on the registry (should NOT be called).
 */
export async function isOnNationalDnc(phone: string): Promise<boolean> {
  const normalized = normalize(phone);
  if (normalized.length !== 10) return false; // Non-US numbers skip check

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('national_dnc')
    .select('phone')
    .eq('phone', normalized)
    .limit(1);

  if (error) {
    console.error('[DNC Registry] Check failed:', error.message);
    // Fail closed — if we can't check, don't send (safer for compliance)
    return true;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Batch-check multiple phone numbers against the National DNC Registry.
 * Returns a Set of numbers that ARE on the registry.
 */
export async function scrubAgainstNationalDnc(phones: string[]): Promise<Set<string>> {
  const blocked = new Set<string>();
  if (phones.length === 0) return blocked;

  const normalized = phones.map((p) => ({ original: p, clean: normalize(p) }));
  const validUS = normalized.filter((n) => n.clean.length === 10);

  if (validUS.length === 0) return blocked;

  const supabase = createServiceClient();

  // Batch query in chunks of 500 (Supabase .in() limit)
  const CHUNK = 500;
  for (let i = 0; i < validUS.length; i += CHUNK) {
    const chunk = validUS.slice(i, i + CHUNK);
    const cleanNumbers = chunk.map((c) => c.clean);

    const { data, error } = await supabase
      .from('national_dnc')
      .select('phone')
      .in('phone', cleanNumbers);

    if (error) {
      console.error('[DNC Registry] Batch check failed:', error.message);
      // Fail closed — block entire chunk
      for (const c of chunk) blocked.add(c.original);
      continue;
    }

    const foundSet = new Set(data?.map((d) => d.phone) ?? []);
    for (const c of chunk) {
      if (foundSet.has(c.clean)) {
        blocked.add(c.original);
      }
    }
  }

  return blocked;
}
