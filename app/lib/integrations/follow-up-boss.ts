/**
 * Follow Up Boss API Integration
 * https://docs.followupboss.com/
 */

const FUB_API_BASE = 'https://api.followupboss.com/v1';

export type FUBPerson = {
  id: number;
  firstName: string;
  lastName: string;
  emails: Array<{ value: string; type?: string }>;
  phones: Array<{ value: string; type?: string }>;
  addresses: Array<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }>;
  stage?: string;
  source?: string;
  tags?: string[];
  assignedTo?: string;
  created: string;
  updated: string;
};

export type FUBNote = {
  personId: number;
  subject: string;
  body: string;
};

export type FUBTestResult = {
  ok: boolean;
  error?: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
};

export type FUBSyncResult = {
  ok: boolean;
  error?: string;
  leads?: Array<{
    id: string;
    crm_id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  total?: number;
  synced?: number;
};

/**
 * Test connection to Follow Up Boss API
 */
export async function testConnection(apiKey: string): Promise<FUBTestResult> {
  try {
    // The API key is used as username with any password (using 'x' as password)
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:x`).toString('base64');

    const response = await fetch(`${FUB_API_BASE}/me`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.message || `API returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
      },
    };
  } catch (error) {
    console.error('[FUB] Test connection error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Fetch all people (leads) from Follow Up Boss
 */
export async function fetchPeople(
  apiKey: string,
  options: { limit?: number; offset?: number; updatedSince?: string } = {}
): Promise<{ ok: boolean; error?: string; people?: FUBPerson[]; total?: number }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:x`).toString('base64');
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    let url = `${FUB_API_BASE}/people?limit=${limit}&offset=${offset}`;
    if (options.updatedSince) {
      url += `&updatedSince=${encodeURIComponent(options.updatedSince)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.message || `API returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      people: data.people || [],
      total: data._metadata?.total || data.people?.length || 0,
    };
  } catch (error) {
    console.error('[FUB] Fetch people error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch people',
    };
  }
}

/**
 * Push a note/activity to Follow Up Boss
 */
export async function pushNote(
  apiKey: string,
  note: FUBNote
): Promise<{ ok: boolean; error?: string; noteId?: number }> {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:x`).toString('base64');

    const response = await fetch(`${FUB_API_BASE}/notes`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.message || `API returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      noteId: data.id,
    };
  } catch (error) {
    console.error('[FUB] Push note error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to push note',
    };
  }
}

/**
 * Convert FUB person to our lead format
 */
export function convertPersonToLead(person: FUBPerson): {
  crm_id: string;
  crm_provider: string;
  owner_name: string;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  status: string;
  tags: string[];
} {
  // Get primary email and phone
  const email = person.emails?.[0]?.value || null;
  const phone = person.phones?.[0]?.value || null;

  // Get primary address
  const addr = person.addresses?.[0];
  const propertyAddress = addr
    ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
    : null;

  // Map FUB stage to our status
  const stageToStatus: Record<string, string> = {
    New: 'new',
    Prospect: 'contacted',
    Active: 'interested',
    'Under Contract': 'qualified',
    Closed: 'closed',
    Dead: 'not_interested',
  };

  return {
    crm_id: String(person.id),
    crm_provider: 'follow_up_boss',
    owner_name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown',
    email,
    phone,
    property_address: propertyAddress,
    status: stageToStatus[person.stage || ''] || 'new',
    tags: person.tags || [],
  };
}
