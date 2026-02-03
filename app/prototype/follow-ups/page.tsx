import RunFollowupsButton from './run-followups-button';

export default function PrototypeFollowUpsPage() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <RunFollowupsButton />
      </div>
      <iframe
        src="/prototype/follow-ups.html"
        title="Prototype Follow-Ups"
        className="block flex-1 w-full border-0"
      />
    </div>
  );
}
