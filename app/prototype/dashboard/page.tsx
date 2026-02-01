import RunListingAgentButton from './run-listing-agent-button';

export default function PrototypeDashboardPage() {
  return (
    <div className="relative h-screen w-screen">
      <iframe
        src="/prototype/dashboard.html"
        title="Prototype Dashboard"
        className="block h-full w-full border-0"
      />
      <div className="absolute right-4 top-4 z-10">
        <RunListingAgentButton />
      </div>
    </div>
  );
}
