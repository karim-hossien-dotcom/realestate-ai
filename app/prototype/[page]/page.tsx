const allowedPages = new Set([
  'dashboard',
  'leads',
  'campaigns',
  'follow-ups',
  'conversations',
  'calendar',
  'logs',
  'settings',
  'onboarding',
  'auth',
  'landing',
  'help',
  'lead-details',
]);

export default function PrototypePage({
  params,
}: {
  params?: { page?: string };
}) {
  const rawPage = typeof params?.page === 'string' ? params.page : '';
  const normalizedPage = rawPage.endsWith('.html')
    ? rawPage.slice(0, -5)
    : rawPage;
  const page = normalizedPage || 'dashboard';
  if (!allowedPages.has(page)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 p-6 text-center text-sm text-red-600">
        Unknown prototype page.
      </div>
    );
  }

  return (
    <iframe
      src={`/prototype/${page}.html`}
      title={`Prototype ${page}`}
      className="block h-screen w-screen border-0"
    />
  );
}
