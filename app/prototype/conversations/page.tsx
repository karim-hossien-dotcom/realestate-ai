import InboundAgentControls from './inbound-agent-controls';

export default function PrototypeConversationsPage() {
  return (
    <div className="relative h-screen w-screen">
      <iframe
        src="/prototype/conversations.html"
        title="Prototype Conversations"
        className="block h-full w-full border-0"
      />
      <div className="absolute right-4 top-4 z-10">
        <InboundAgentControls />
      </div>
    </div>
  );
}
