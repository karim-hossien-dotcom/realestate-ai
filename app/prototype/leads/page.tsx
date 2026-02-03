import RunInitLeadsButton from './run-init-button';
import RunListingAgentButton from '../dashboard/run-listing-agent-button';

export default function PrototypeLeadsPage() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <RunInitLeadsButton />
        <RunListingAgentButton />
      </div>
      <iframe
        src="/prototype/leads.html"
        title="Prototype Leads"
        className="block flex-1 w-full border-0"
      />
    </div>
  );
}
