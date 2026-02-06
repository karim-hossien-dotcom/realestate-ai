import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/app/lib/google-calendar';
import { withAuth } from '@/app/lib/auth';

export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  // Generate OAuth URL with user ID as state
  const authUrl = getAuthUrl(auth.user.id);

  return NextResponse.json({ url: authUrl });
}
