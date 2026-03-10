import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/server';

/**
 * GET /api/email/unsubscribe?email=...&uid=...
 * One-click email unsubscribe (CAN-SPAM compliant).
 * Adds the email to the user's DNC list and shows confirmation page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.toLowerCase().trim();
  const userId = searchParams.get('uid');

  if (!email || !userId) {
    return new NextResponse(renderPage('Missing Parameters', 'Invalid unsubscribe link. Please contact support@realestate-ai.app for assistance.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const supabase = createServiceClient();

    // Add to DNC list (upsert to avoid duplicates)
    const { error } = await supabase
      .from('dnc_list')
      .upsert(
        {
          user_id: userId,
          phone: email, // dnc_list.phone stores both phones and emails
          reason: 'Email unsubscribe link clicked',
          source: 'email_unsubscribe',
        },
        { onConflict: 'user_id,phone', ignoreDuplicates: true }
      );

    if (error) {
      console.error('[Unsubscribe] DB error:', error);
      return new NextResponse(renderPage('Error', 'Something went wrong. Please contact support@realestate-ai.app to be removed from our mailing list.'), {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Log the unsubscribe activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'email_unsubscribe',
      details: { email, source: 'unsubscribe_link' },
    });

    console.log('[Unsubscribe] Success:', email, 'for user:', userId);

    return new NextResponse(renderPage('Unsubscribed', 'You have been successfully unsubscribed. You will no longer receive marketing emails from this agent.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    console.error('[Unsubscribe] Unexpected error:', err);
    return new NextResponse(renderPage('Error', 'Something went wrong. Please contact support@realestate-ai.app to be removed from our mailing list.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Estate AI</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; text-align: center; color: #333; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { font-size: 16px; line-height: 1.6; color: #555; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <p style="margin-top: 32px; font-size: 13px; color: #999;">
    EYWA Consulting Services Inc &bull; 700 1st St, Hoboken, NJ 07030
  </p>
</body>
</html>`;
}
