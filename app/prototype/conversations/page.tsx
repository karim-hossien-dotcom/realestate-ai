import InboundAgentControls from './inbound-agent-controls';

export default function PrototypeConversationsPage() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <InboundAgentControls />
      </div>
      <iframe
        src="/prototype/conversations.html"
        title="Prototype Conversations"
        className="block flex-1 w-full border-0"
      />
    </div>
  );
}
