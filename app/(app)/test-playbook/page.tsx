'use client';

import { useState } from 'react';
import { useToast } from '@/app/components/ToastProvider';

type UseCase = {
  id: number;
  tag: string;
  name: string;
  lead: string;
  property: string;
  scenario: string;
  messagePreview: string;
  replyScript: string;
  expectedBehavior: string;
  verifyIn: string;
  multiTurn?: { turn: number; reply: string; expected: string }[];
};

const USE_CASES: UseCase[] = [
  {
    id: 1,
    tag: 'UC1',
    name: 'Cold Outreach',
    lead: 'Ahmad Hassan',
    property: '123 Main St, Newark NJ',
    scenario: 'Verify WhatsApp delivery — no reply needed',
    messagePreview:
      'I noticed your property at 123 Main St and wanted to reach out. The commercial market in Newark has been very active...',
    replyScript: '(No reply needed — just verify the message arrives on your phone)',
    expectedBehavior: 'Message delivered via realestate_outreach template',
    verifyIn: 'Campaigns page → status "Sent" | Conversations → outbound message visible',
  },
  {
    id: 2,
    tag: 'UC2',
    name: 'Interested Seller',
    lead: 'Sarah Mitchell',
    property: '456 Oak Ave, Jersey City NJ',
    scenario: 'Reply expressing interest → AI starts qualification',
    messagePreview:
      "I've been working with investors eyeing properties on Oak Ave in Jersey City...",
    replyScript: "Yes I'm interested, what do you think my property is worth?",
    expectedBehavior:
      'AI classifies intent as "interested", offers a free CMA, asks for property details (bedrooms, sqft, timeline)',
    verifyIn: 'Conversations → AI reply visible | Activity Logs → "message_reply" event',
  },
  {
    id: 3,
    tag: 'UC3',
    name: 'Not Interested',
    lead: 'James Wilson',
    property: '789 Elm Dr, Hoboken NJ',
    scenario: 'Polite decline → AI closes gracefully',
    messagePreview:
      'Properties like yours at 789 Elm Dr are in high demand in Hoboken right now...',
    replyScript: 'No thanks, not looking to sell',
    expectedBehavior:
      'AI classifies "not_interested", responds professionally, suggests reaching out in the future',
    verifyIn: 'Conversations → graceful close message | Logs → intent: not_interested',
  },
  {
    id: 4,
    tag: 'UC4',
    name: 'STOP / DNC',
    lead: 'Maria Garcia',
    property: '321 Pine Rd, Bayonne NJ',
    scenario: 'Reply STOP → DNC compliance enforcement',
    messagePreview:
      "I'm reaching out about your property at 321 Pine Rd. The Bayonne market has seen strong activity...",
    replyScript: 'STOP',
    expectedBehavior:
      'Added to DNC list, unsubscribe confirmation sent ("You\'re unsubscribed..."), future campaign sends to this lead skip with "On DNC list"',
    verifyIn:
      'Phone → receive unsubscribe confirmation | Logs → opt_out event | Re-run campaign → this lead shows "Skipped"',
  },
  {
    id: 5,
    tag: 'UC5',
    name: 'Full Qualification → Meeting',
    lead: 'David Chen',
    property: '555 Broadway, Paterson NJ',
    scenario: 'Multi-turn conversation leading to meeting booking',
    messagePreview:
      'Your property at 555 Broadway caught my eye. I work with serious buyers looking for commercial space...',
    replyScript: 'Maybe, tell me more',
    expectedBehavior: 'AI asks about property details, progressively qualifies, books meeting when date+time given',
    verifyIn:
      'Conversations → multi-turn thread | Calendar → meeting created | Lead notes → qualification data',
    multiTurn: [
      {
        turn: 1,
        reply: 'Maybe, tell me more',
        expected: 'AI asks about property details (beds, bath, sqft, type)',
      },
      {
        turn: 2,
        reply: "It's a 3 bed 2 bath, about 1800 sqft commercial space",
        expected: 'AI acknowledges, asks about timeline and price expectation',
      },
      {
        turn: 3,
        reply: 'Looking to sell in the next 2-3 months, thinking around $450K',
        expected: 'AI acknowledges price, asks to schedule a meeting',
      },
      {
        turn: 4,
        reply: 'How about next Tuesday at 2pm?',
        expected:
          'AI confirms meeting, creates calendar entry, generates agent brief',
      },
    ],
  },
  {
    id: 6,
    tag: 'UC6',
    name: 'Escalation',
    lead: 'Robert Kim',
    property: '777 River Rd, Edgewater NJ',
    scenario: 'Angry/legal threat → AI escalates to human agent',
    messagePreview:
      'I noticed your property at 777 River Rd and wanted to connect. Edgewater waterfront properties...',
    replyScript: "This is harassment! I'm going to report you to the authorities!",
    expectedBehavior:
      'AI classifies "escalate", sends de-escalation message ("I understand your concern..."), notifies agent if AGENT_PHONE set',
    verifyIn: 'Conversations → de-escalation reply | Logs → escalation event',
  },
  {
    id: 7,
    tag: 'UC7',
    name: 'Buyer Lead',
    lead: 'Linda Park',
    property: '999 Harbor Blvd, Weehawken NJ',
    scenario: 'Prospect wants to BUY, not sell → AI switches to buyer qualification',
    messagePreview:
      'Your property at 999 Harbor Blvd is in a prime Weehawken location. I have active buyers...',
    replyScript: "Actually I'm looking to BUY a property in this area, not sell",
    expectedBehavior:
      'AI classifies "buyer", switches to buyer qualification (budget, preferred area, property type, pre-approval status)',
    verifyIn: 'Conversations → buyer-specific questions | Logs → intent: buyer',
  },
  {
    id: 8,
    tag: 'UC8',
    name: 'Arabic Reply',
    lead: 'Omar Farouq',
    property: '222 Bergen Ave, Kearny NJ',
    scenario: 'Reply in Arabic → AI responds in Arabic',
    messagePreview:
      "I'm reaching out about your property at 222 Bergen Ave. The Kearny market has been heating up...",
    replyScript: 'مرحبا، نعم أنا مهتم بالبيع',
    expectedBehavior:
      'AI responds in Arabic, continues qualification flow in Arabic',
    verifyIn: 'Conversations → Arabic AI reply',
  },
];

export default function TestPlaybookPage() {
  const { showToast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [expandedUC, setExpandedUC] = useState<number | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/test/seed-leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${prompt('Enter CRON_SECRET:')}`,
        },
      });
      const data = await res.json();
      if (data.ok) {
        setSeeded(true);
        showToast(`Seeded ${data.created} test leads`, 'success');
      } else {
        showToast(data.error || 'Seed failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const tagColors: Record<string, string> = {
    UC1: 'bg-blue-100 text-blue-700',
    UC2: 'bg-green-100 text-green-700',
    UC3: 'bg-gray-100 text-gray-700',
    UC4: 'bg-red-100 text-red-700',
    UC5: 'bg-purple-100 text-purple-700',
    UC6: 'bg-orange-100 text-orange-700',
    UC7: 'bg-cyan-100 text-cyan-700',
    UC8: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          <i className="fas fa-flask mr-2 text-purple-600"></i>WhatsApp Test Playbook
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          8 use cases to test the full WhatsApp pipeline end-to-end
        </p>
      </div>

      {/* Seed Button */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Step 1: Seed Test Leads
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Creates 8 test leads in your database with pre-written messages. All leads use your phone number (+1 347-445-2049) so you receive the WhatsApp messages directly.
        </p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            seeded
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
          }`}
        >
          {seeding ? (
            <><i className="fas fa-spinner fa-spin mr-2"></i>Seeding...</>
          ) : seeded ? (
            <><i className="fas fa-check mr-2"></i>Leads Seeded</>
          ) : (
            <><i className="fas fa-seedling mr-2"></i>Seed Test Leads</>
          )}
        </button>
      </div>

      {/* Testing Flow */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
          Step 2: Send Campaign
        </h2>
        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1.5 list-decimal list-inside">
          <li>Go to <strong>Campaigns</strong> page</li>
          <li>Select all 8 test leads (they have "wa-test" tag)</li>
          <li>Choose channel: <strong>WhatsApp</strong></li>
          <li>Select template: <strong>Real Estate Outreach</strong></li>
          <li>Click <strong>Send Campaign Now</strong></li>
          <li>Check your phone — 8 messages should arrive</li>
        </ol>
      </div>

      {/* Step 3: Reply Scripts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Step 3: Reply & Verify Each Use Case
        </h2>

        <div className="space-y-3">
          {USE_CASES.map((uc) => (
            <div
              key={uc.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Header (clickable) */}
              <button
                onClick={() => setExpandedUC(expandedUC === uc.id ? null : uc.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${tagColors[uc.tag] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {uc.tag}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {uc.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                    — {uc.lead}
                  </span>
                </div>
                <i
                  className={`fas fa-chevron-${expandedUC === uc.id ? 'up' : 'down'} text-gray-400`}
                ></i>
              </button>

              {/* Expanded Details */}
              {expandedUC === uc.id && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Info */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Lead</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {uc.lead} — {uc.property}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Scenario</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{uc.scenario}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Message Sent
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          &quot;{uc.messagePreview}&quot;
                        </p>
                      </div>
                    </div>

                    {/* Right: Action */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-green-600 uppercase">
                          Reply From Phone
                        </p>
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-1">
                          <p className="text-sm font-mono text-green-800 dark:text-green-300" dir="auto">
                            {uc.replyScript}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-600 uppercase">
                          Expected AI Behavior
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {uc.expectedBehavior}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-purple-600 uppercase">
                          Verify In
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{uc.verifyIn}</p>
                      </div>
                    </div>
                  </div>

                  {/* Multi-turn (UC5) */}
                  {uc.multiTurn && (
                    <div>
                      <p className="text-xs font-medium text-purple-600 uppercase mb-2">
                        Multi-Turn Conversation Script
                      </p>
                      <div className="space-y-2">
                        {uc.multiTurn.map((turn) => (
                          <div
                            key={turn.turn}
                            className="flex gap-3 items-start bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3"
                          >
                            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded flex-shrink-0">
                              Turn {turn.turn}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                &quot;{turn.reply}&quot;
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {turn.expected}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Verification Checklist
        </h2>
        <div className="space-y-2 text-sm">
          {[
            'Campaigns page: All 8 sends show "Sent" status',
            'Phone: All 8 WhatsApp messages received',
            'Conversations page: All threads visible with outbound messages',
            'Inbound replies appear in Conversations (15s poll)',
            'AI responses are contextual per use case',
            'UC4: DNC list has the number after STOP reply',
            'UC4: Re-run campaign → Maria lead shows "Skipped - On DNC list"',
            'UC5: Meeting created in Calendar after date+time given',
            'UC5: Lead notes updated with qualification data (beds, sqft, price)',
            'UC6: Activity logs show "escalation" event',
            'UC8: AI reply is in Arabic',
            'Rate limiting: If you send >20 to same number in a day, it shows "Rate limited"',
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
