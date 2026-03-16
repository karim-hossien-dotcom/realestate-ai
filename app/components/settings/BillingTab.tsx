'use client';

import type { BillingData, PlanDef } from './types';

type BillingTabProps = {
  billingData: BillingData | null;
  billingLoading: boolean;
  billingError: string | null;
  checkoutLoading: string | null;
  plans: PlanDef[];
  onCheckout: (priceId: string) => void;
  onManageBilling: () => void;
};

export default function BillingTab({
  billingData,
  billingLoading,
  billingError,
  checkoutLoading,
  plans,
  onCheckout,
  onManageBilling,
}: BillingTabProps) {
  return (
    <section className="space-y-6 max-w-5xl">
      {billingError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {billingError}
        </div>
      )}

      {billingLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Current Subscription Status */}
          {billingData?.subscription ? (
            <SubscriptionCard
              subscription={billingData.subscription}
              onManageBilling={onManageBilling}
            />
          ) : (
            <TrialBanner />
          )}

          {/* Usage Stats */}
          {billingData?.subscription && (
            <UsageStats usage={billingData.usage} />
          )}

          {/* Overage Charges */}
          {billingData?.overages && billingData.overages.estimatedCost > 0 && (
            <OverageCard
              overages={billingData.overages}
              overageRates={billingData.overageRates}
            />
          )}

          {/* Plan Cards */}
          <PlanCards
            plans={plans}
            currentPlanSlug={billingData?.subscription?.planSlug ?? null}
            hasSubscription={!!billingData?.subscription}
            checkoutLoading={checkoutLoading}
            onCheckout={onCheckout}
            onManageBilling={onManageBilling}
          />
        </>
      )}
    </section>
  );
}

/* --- Sub-components --- */

function SubscriptionCard({
  subscription,
  onManageBilling,
}: {
  subscription: NonNullable<BillingData['subscription']>;
  onManageBilling: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Current Plan</h3>
        <button
          onClick={onManageBilling}
          className="text-sm px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <i className="fas fa-external-link-alt mr-2"></i>
          Manage Billing
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Plan</span>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{subscription.plan}</p>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
          <p className="text-lg font-semibold">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
              subscription.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
              subscription.status === 'trialing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            }`}>
              {subscription.status === 'trialing' ? 'Free Trial' : subscription.status}
            </span>
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {subscription.status === 'trialing' ? 'Trial ends' : 'Renews'}
          </span>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {new Date(subscription.trialEnd || subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {subscription.cancelAtPeriodEnd && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
          <i className="fas fa-exclamation-triangle mr-2"></i>
          Your subscription will be cancelled at the end of the current billing period.
        </div>
      )}
    </div>
  );
}

function TrialBanner() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
          <i className="fas fa-gift text-blue-600 dark:text-blue-400"></i>
        </div>
        <div>
          <h3 className="font-semibold text-blue-900 dark:text-blue-300">Start your 14-day free trial</h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">Choose a plan below to get started. No charge during trial.</p>
        </div>
      </div>
    </div>
  );
}

function UsageStats({ usage }: { usage: BillingData['usage'] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Usage This Period</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* SMS Usage */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">SMS Sent</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {usage.sms}{usage.includedSms > 0 ? `/${usage.includedSms}` : ''}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                usage.includedSms > 0 && usage.sms / usage.includedSms > 0.9
                  ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, usage.includedSms > 0 ? (usage.sms / usage.includedSms) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {/* Email Usage */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">Emails</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{usage.email}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">Unlimited</span>
        </div>

        {/* WhatsApp Usage */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">WhatsApp</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{usage.whatsapp}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">Pay per use</span>
        </div>

        {/* Leads */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">Leads</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {usage.leads}{usage.includedLeads > 0 ? `/${usage.includedLeads}` : ''}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                usage.includedLeads > 0 && usage.leads / usage.includedLeads > 0.9
                  ? 'bg-red-500' : 'bg-purple-500'
              }`}
              style={{ width: `${Math.min(100, usage.includedLeads > 0 ? (usage.leads / usage.includedLeads) * 100 : 0)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OverageCard({
  overages,
  overageRates,
}: {
  overages: NonNullable<BillingData['overages']>;
  overageRates: BillingData['overageRates'];
}) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Overage Charges</h3>
        <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
          ${(overages.estimatedCost / 100).toFixed(2)}
        </span>
      </div>
      <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
        Usage beyond your plan&apos;s included quota is billed at the end of your billing cycle.
      </p>
      <div className="space-y-2 text-sm">
        {overages.sms > 0 && (
          <div className="flex justify-between text-amber-800 dark:text-amber-300">
            <span>SMS overage ({overages.sms} msgs × ${((overageRates?.sms || 5) / 100).toFixed(2)})</span>
            <span>${(overages.sms * (overageRates?.sms || 5) / 100).toFixed(2)}</span>
          </div>
        )}
        {overages.email > 0 && (
          <div className="flex justify-between text-amber-800 dark:text-amber-300">
            <span>Email overage ({overages.email} msgs × ${((overageRates?.email || 2) / 100).toFixed(2)})</span>
            <span>${(overages.email * (overageRates?.email || 2) / 100).toFixed(2)}</span>
          </div>
        )}
        {overages.whatsapp > 0 && (
          <div className="flex justify-between text-amber-800 dark:text-amber-300">
            <span>WhatsApp overage ({overages.whatsapp} msgs × ${((overageRates?.whatsapp || 8) / 100).toFixed(2)})</span>
            <span>${(overages.whatsapp * (overageRates?.whatsapp || 8) / 100).toFixed(2)}</span>
          </div>
        )}
        {overages.leads > 0 && (
          <div className="flex justify-between text-amber-800 dark:text-amber-300">
            <span>Lead overage ({overages.leads} leads × ${((overageRates?.leads || 15) / 100).toFixed(2)})</span>
            <span>${(overages.leads * (overageRates?.leads || 15) / 100).toFixed(2)}</span>
          </div>
        )}
      </div>
      {overages.reported && (
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">Already included in your upcoming invoice.</p>
      )}
    </div>
  );
}

function PlanCards({
  plans,
  currentPlanSlug,
  hasSubscription,
  checkoutLoading,
  onCheckout,
  onManageBilling,
}: {
  plans: PlanDef[];
  currentPlanSlug: string | null;
  hasSubscription: boolean;
  checkoutLoading: string | null;
  onCheckout: (priceId: string) => void;
  onManageBilling: () => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {hasSubscription ? 'Change Plan' : 'Choose a Plan'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlanSlug === plan.slug;
          return (
            <div
              key={plan.slug}
              className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 p-6 transition-all ${
                plan.popular
                  ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                  : isCurrentPlan
                  ? 'border-green-500 dark:border-green-400'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {plan.popular && !isCurrentPlan && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              {isCurrentPlan && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Current Plan
                </span>
              )}

              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{plan.name}</h4>
              <div className="flex items-baseline mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <i className="fas fa-check text-green-500 mt-0.5 flex-shrink-0"></i>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <button
                  onClick={onManageBilling}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Manage Plan
                </button>
              ) : (
                <button
                  onClick={() => onCheckout(plan.stripePriceId)}
                  disabled={!!checkoutLoading || !plan.stripePriceId}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                      : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-400'
                  }`}
                >
                  {checkoutLoading === plan.stripePriceId ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i>Loading...</>
                  ) : hasSubscription ? (
                    'Switch Plan'
                  ) : (
                    'Start Free Trial'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
        All plans include a 14-day free trial. Cancel anytime. Prices in USD.
      </p>
    </div>
  );
}
