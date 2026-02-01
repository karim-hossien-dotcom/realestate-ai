import RunFollowupsButton from './run-followups-button';

export default function PrototypeFollowUpsPage() {
  return (
    <div className="relative h-screen w-screen">
      <iframe
        src="/prototype/follow-ups.html"
        title="Prototype Follow-Ups"
        className="block h-full w-full border-0"
      />
      <div className="absolute right-4 top-4 z-10">
        <RunFollowupsButton />
      </div>
    </div>
  );
}
