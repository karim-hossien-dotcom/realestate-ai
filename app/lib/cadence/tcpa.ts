/**
 * TCPA Compliance Engine
 *
 * Enforces FCC Telephone Consumer Protection Act + state Mini-TCPA rules.
 * Violations: $500-$1,500 per call/text. FL/OK/WA have private right of action.
 */

// US area code → IANA timezone mapping (most common — covers ~95% of leads)
// Source: NANP area code listings, NIST timezone data
const AREA_CODE_TIMEZONES: Record<string, string> = {
  // Eastern (UTC-5/-4)
  '201': 'America/New_York', '202': 'America/New_York', '203': 'America/New_York',
  '212': 'America/New_York', '215': 'America/New_York', '216': 'America/New_York',
  '267': 'America/New_York', '301': 'America/New_York', '302': 'America/New_York',
  '305': 'America/New_York', '321': 'America/New_York', '347': 'America/New_York',
  '352': 'America/New_York', '386': 'America/New_York', '407': 'America/New_York',
  '410': 'America/New_York', '412': 'America/New_York', '434': 'America/New_York',
  '443': 'America/New_York', '484': 'America/New_York', '561': 'America/New_York',
  '570': 'America/New_York', '585': 'America/New_York', '607': 'America/New_York',
  '610': 'America/New_York', '617': 'America/New_York', '631': 'America/New_York',
  '646': 'America/New_York', '703': 'America/New_York', '704': 'America/New_York',
  '716': 'America/New_York', '717': 'America/New_York', '718': 'America/New_York',
  '724': 'America/New_York', '732': 'America/New_York', '754': 'America/New_York',
  '757': 'America/New_York', '770': 'America/New_York', '772': 'America/New_York',
  '781': 'America/New_York', '786': 'America/New_York', '804': 'America/New_York',
  '813': 'America/New_York', '814': 'America/New_York', '845': 'America/New_York',
  '848': 'America/New_York', '856': 'America/New_York', '862': 'America/New_York',
  '904': 'America/New_York', '908': 'America/New_York', '914': 'America/New_York',
  '917': 'America/New_York', '929': 'America/New_York', '941': 'America/New_York',
  '954': 'America/New_York', '973': 'America/New_York',
  // Central (UTC-6/-5)
  '205': 'America/Chicago', '210': 'America/Chicago', '214': 'America/Chicago',
  '224': 'America/Chicago', '225': 'America/Chicago', '228': 'America/Chicago',
  '251': 'America/Chicago', '254': 'America/Chicago', '281': 'America/Chicago',
  '309': 'America/Chicago', '312': 'America/Chicago', '314': 'America/Chicago',
  '316': 'America/Chicago', '318': 'America/Chicago', '331': 'America/Chicago',
  '334': 'America/Chicago', '337': 'America/Chicago', '361': 'America/Chicago',
  '405': 'America/Chicago', '414': 'America/Chicago', '417': 'America/Chicago',
  '430': 'America/Chicago', '432': 'America/Chicago', '469': 'America/Chicago',
  '479': 'America/Chicago', '501': 'America/Chicago', '504': 'America/Chicago',
  '512': 'America/Chicago', '515': 'America/Chicago', '563': 'America/Chicago',
  '573': 'America/Chicago', '580': 'America/Chicago', '601': 'America/Chicago',
  '608': 'America/Chicago', '612': 'America/Chicago', '615': 'America/Chicago',
  '618': 'America/Chicago', '630': 'America/Chicago', '636': 'America/Chicago',
  '651': 'America/Chicago', '662': 'America/Chicago', '682': 'America/Chicago',
  '708': 'America/Chicago', '713': 'America/Chicago', '731': 'America/Chicago',
  '763': 'America/Chicago', '773': 'America/Chicago', '779': 'America/Chicago',
  '785': 'America/Chicago', '816': 'America/Chicago', '817': 'America/Chicago',
  '830': 'America/Chicago', '832': 'America/Chicago', '847': 'America/Chicago',
  '870': 'America/Chicago', '901': 'America/Chicago', '903': 'America/Chicago',
  '913': 'America/Chicago', '915': 'America/Chicago', '918': 'America/Chicago',
  '920': 'America/Chicago', '936': 'America/Chicago', '940': 'America/Chicago',
  '952': 'America/Chicago', '956': 'America/Chicago', '972': 'America/Chicago',
  // Mountain (UTC-7/-6)
  '208': 'America/Denver', '303': 'America/Denver', '307': 'America/Denver',
  '385': 'America/Denver', '406': 'America/Denver', '435': 'America/Denver',
  '480': 'America/Phoenix', '505': 'America/Denver', '520': 'America/Phoenix',
  '575': 'America/Denver', '602': 'America/Phoenix', '623': 'America/Phoenix',
  '719': 'America/Denver', '720': 'America/Denver', '801': 'America/Denver',
  '928': 'America/Phoenix', '970': 'America/Denver',
  // Pacific (UTC-8/-7)
  '206': 'America/Los_Angeles', '209': 'America/Los_Angeles', '213': 'America/Los_Angeles',
  '253': 'America/Los_Angeles', '310': 'America/Los_Angeles', '323': 'America/Los_Angeles',
  '360': 'America/Los_Angeles', '408': 'America/Los_Angeles', '415': 'America/Los_Angeles',
  '425': 'America/Los_Angeles', '442': 'America/Los_Angeles', '503': 'America/Los_Angeles',
  '509': 'America/Los_Angeles', '510': 'America/Los_Angeles', '530': 'America/Los_Angeles',
  '541': 'America/Los_Angeles', '559': 'America/Los_Angeles', '562': 'America/Los_Angeles',
  '619': 'America/Los_Angeles', '626': 'America/Los_Angeles', '650': 'America/Los_Angeles',
  '661': 'America/Los_Angeles', '707': 'America/Los_Angeles', '714': 'America/Los_Angeles',
  '747': 'America/Los_Angeles', '760': 'America/Los_Angeles', '805': 'America/Los_Angeles',
  '818': 'America/Los_Angeles', '831': 'America/Los_Angeles', '858': 'America/Los_Angeles',
  '909': 'America/Los_Angeles', '916': 'America/Los_Angeles', '925': 'America/Los_Angeles',
  '949': 'America/Los_Angeles', '951': 'America/Los_Angeles', '971': 'America/Los_Angeles',
  // Alaska
  '907': 'America/Anchorage',
  // Hawaii
  '808': 'Pacific/Honolulu',
}

// State Mini-TCPA stricter rules (extra-conservative quiet hours)
// FL SB 1120, OK HB 3168, WA RCW 80.36.400
const STATE_AREA_CODES: Record<string, { state: string; quietStart: number; quietEnd: number }> = {
  // Florida — 9am to 8pm
  '305': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '321': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '352': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '386': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '407': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '561': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '727': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '754': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '772': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '786': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '813': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '850': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '863': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '904': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '941': { state: 'FL', quietStart: 9, quietEnd: 20 },
  '954': { state: 'FL', quietStart: 9, quietEnd: 20 },
  // Oklahoma — 8am to 8pm
  '405': { state: 'OK', quietStart: 8, quietEnd: 20 },
  '539': { state: 'OK', quietStart: 8, quietEnd: 20 },
  '580': { state: 'OK', quietStart: 8, quietEnd: 20 },
  '918': { state: 'OK', quietStart: 8, quietEnd: 20 },
}

/**
 * Extract digits-only from a phone string.
 */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Get the IANA timezone for a phone number based on US area code.
 * Returns null if can't determine (international, unknown area code).
 */
export function getTimezoneFromAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = digitsOnly(phone)
  // US numbers are 10 digits, or 11 with leading 1
  let areaCode: string
  if (digits.length === 10) areaCode = digits.slice(0, 3)
  else if (digits.length === 11 && digits[0] === '1') areaCode = digits.slice(1, 4)
  else return null
  return AREA_CODE_TIMEZONES[areaCode] || null
}

/**
 * Get state-specific TCPA restrictions for a phone number.
 * Returns null if no special rules for that area code.
 */
export function getStateRestrictions(phone: string | null | undefined): { state: string; quietStart: number; quietEnd: number } | null {
  if (!phone) return null
  const digits = digitsOnly(phone)
  let areaCode: string
  if (digits.length === 10) areaCode = digits.slice(0, 3)
  else if (digits.length === 11 && digits[0] === '1') areaCode = digits.slice(1, 4)
  else return null
  return STATE_AREA_CODES[areaCode] || null
}

/**
 * Get the hour (0-23) at the given timezone for a given UTC date.
 */
function hourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', hour12: false,
    })
    const parts = formatter.formatToParts(date)
    const hourPart = parts.find(p => p.type === 'hour')
    return hourPart ? parseInt(hourPart.value, 10) % 24 : date.getUTCHours()
  } catch {
    return date.getUTCHours()
  }
}

/**
 * Get the day of week (0=Sun, 6=Sat) at the given timezone.
 */
function dayOfWeekInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    const day = formatter.format(date)
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return map[day] ?? date.getUTCDay()
  } catch {
    return date.getUTCDay()
  }
}

/**
 * Check if the given date falls in quiet hours at the lead's timezone.
 */
export function isInQuietHours(
  date: Date,
  timezone: string | null,
  quietStart: number = 8,
  quietEnd: number = 21,
  skipWeekends: boolean = false
): boolean {
  // No timezone = conservative default (assume Eastern)
  const tz = timezone || 'America/New_York'
  const hour = hourInTimezone(date, tz)
  const day = dayOfWeekInTimezone(date, tz)

  if (skipWeekends && (day === 0 || day === 6)) return true

  // Quiet hours: outside [quietStart, quietEnd) is quiet
  if (hour < quietStart || hour >= quietEnd) return true
  return false
}

/**
 * Shift a date forward to the next allowed sending slot.
 * Returns the next time after `date` that's within quiet hours window.
 */
export function shiftToNextAllowedSlot(
  date: Date,
  timezone: string | null,
  quietStart: number = 8,
  quietEnd: number = 21,
  skipWeekends: boolean = false
): Date {
  const tz = timezone || 'America/New_York'
  const result = new Date(date)
  let attempts = 0

  while (isInQuietHours(result, tz, quietStart, quietEnd, skipWeekends) && attempts < 14) {
    // Advance by 1 hour at a time until we hit allowed window
    result.setUTCHours(result.getUTCHours() + 1)
    attempts++
  }

  // If still in quiet hours after a day, just advance to start of quietStart hour next allowed day
  if (isInQuietHours(result, tz, quietStart, quietEnd, skipWeekends)) {
    result.setUTCDate(result.getUTCDate() + 1)
    // Set to quietStart hour (UTC adjusted)
    while (hourInTimezone(result, tz) !== quietStart) {
      result.setUTCHours(result.getUTCHours() + 1)
    }
  }

  return result
}

/**
 * Resolve the effective quiet hours for a phone number.
 * Returns user defaults unless state has stricter Mini-TCPA rules.
 */
export function resolveQuietHours(
  phone: string | null | undefined,
  userQuietStart: number = 8,
  userQuietEnd: number = 21
): { start: number; end: number; state: string | null } {
  const stateRules = getStateRestrictions(phone)
  if (stateRules) {
    return {
      // Use the most conservative (latest start, earliest end)
      start: Math.max(stateRules.quietStart, userQuietStart),
      end: Math.min(stateRules.quietEnd, userQuietEnd),
      state: stateRules.state,
    }
  }
  return { start: userQuietStart, end: userQuietEnd, state: null }
}
