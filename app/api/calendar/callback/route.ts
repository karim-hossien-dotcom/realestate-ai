import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/app/lib/google-calendar';
import { createServiceClient } from '@/app/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // user_id
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/prototype/calendar?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/prototype/calendar?error=Missing+code+or+state', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Store tokens in database
    const supabase = createServiceClient();

    const { error: dbError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('[Calendar Callback] DB error:', dbError);
      return NextResponse.redirect(
        new URL(`/prototype/calendar?error=${encodeURIComponent(dbError.message)}`, request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/prototype/calendar?success=true', request.url)
    );
  } catch (err) {
    console.error('[Calendar Callback] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/prototype/calendar?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
