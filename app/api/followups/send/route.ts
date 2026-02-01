import { sendViaProvider } from '../providers';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return sendViaProvider(request, body as Record<string, unknown>);
}
