import RunInitLeadsButton from './run-init-button';

export default function PrototypeLeadsPage() {
  return (
    <div className="relative h-screen w-screen">
      <iframe
        src="/prototype/leads.html"
        title="Prototype Leads"
        className="block h-full w-full border-0"
      />
      <div className="absolute right-4 top-4 z-10">
        <RunInitLeadsButton />
      </div>
    </div>
  );
}
