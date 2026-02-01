import FollowupsDemoWidget from './followups-demo-widget';

export default function PrototypeDemoPage() {
  return (
    <div className="min-h-screen w-full bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Prototype Demo Guide</h1>
          <p className="mt-2 text-sm text-gray-600">
            Use this checklist to demo the full UI flow plus the Follow-Ups demo run.
          </p>

          <div className="mt-6 space-y-4 text-sm">
            <div>
              <div className="font-semibold">1) Start here</div>
              <div className="text-gray-700">Open the dashboard:</div>
              <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 font-mono">
                /prototype/dashboard
              </div>
            </div>

            <div>
              <div className="font-semibold">2) Navigate through key pages</div>
              <div className="text-gray-700">
                Use the sidebar to visit Leads, Campaigns, Conversations, Calendar, Logs, and
                Settings.
              </div>
            </div>

            <div>
              <div className="font-semibold">3) Follow-Ups demo (backend)</div>
              <div className="text-gray-700">
                Go to Follow-Ups and click <span className="font-semibold">Run Follow-Ups</span>.
                You should see a demo message and sample follow-ups (no WhatsApp token required).
              </div>
              <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 font-mono">
                /prototype/follow-ups
              </div>
            </div>

            <div>
              <div className="font-semibold">4) Optional pages</div>
              <div className="text-gray-700">
                Landing, Help, Onboarding, Lead Details, and Auth are available for extra walkthrough
                flows.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Tip: If the dev server was restarted, hard-refresh your browser (Ctrl+F5).
          </div>

          <div className="mt-6">
            <FollowupsDemoWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
