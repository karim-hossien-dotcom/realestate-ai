export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type FUBStatus = {
  connected: boolean;
  status?: string;
  lastSyncAt?: string;
  errorMessage?: string;
  leadsFromCrm?: number;
};

export type SettingsSection =
  | 'profile'
  | 'integrations'
  | 'ai-personality'
  | 'messaging'
  | 'email'
  | 'team'
  | 'auto-reply'
  | 'billing';

export type BillingData = {
  subscription: {
    status: string;
    plan: string;
    planSlug: string | null;
    currentPeriodEnd: string;
    trialEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    sms: number;
    email: number;
    whatsapp: number;
    leads: number;
    includedSms: number;
    includedLeads: number;
    totalMessages: number;
    includedMessages: number;
  };
  overages?: {
    sms: number;
    email: number;
    whatsapp: number;
    leads: number;
    estimatedCost: number;
    reported: boolean;
  };
  overageRates?: {
    sms: number;
    email: number;
    whatsapp: number;
    leads: number;
  };
};

export type AiConfig = {
  tone: string;
  language: string;
  introduction_template: string | null;
  qualification_questions: string[];
  escalation_message: string | null;
  closing_style: string;
  property_focus: string;
  custom_instructions: string | null;
  active: boolean;
};

export type PlanDef = {
  slug: string;
  name: string;
  price: string;
  period: string;
  popular?: boolean;
  features: string[];
  stripePriceId: string;
};

export const settingsSections = [
  { id: 'profile' as const, label: 'Profile & Account', icon: 'fa-user', shortLabel: 'Profile' },
  { id: 'integrations' as const, label: 'Integrations', icon: 'fa-plug', shortLabel: 'CRM' },
  { id: 'ai-personality' as const, label: 'AI Personality', icon: 'fa-brain', shortLabel: 'AI' },
  { id: 'messaging' as const, label: 'Messaging Provider', icon: 'fa-sms', comingSoon: true, shortLabel: 'Messaging' },
  { id: 'email' as const, label: 'Email Settings', icon: 'fa-envelope', comingSoon: true, shortLabel: 'Email' },
  { id: 'team' as const, label: 'Team Management', icon: 'fa-users-cog', comingSoon: true, shortLabel: 'Team' },
  { id: 'auto-reply' as const, label: 'Auto-Reply', icon: 'fa-robot', comingSoon: true, shortLabel: 'Auto-Reply' },
  { id: 'billing' as const, label: 'Billing & Plans', icon: 'fa-credit-card', shortLabel: 'Billing' },
];
