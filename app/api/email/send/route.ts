import { NextResponse } from 'next/server';
import { withAuth, logActivity } from '@/app/lib/auth';
import { sendEmail, generateOutreachEmail } from '@/app/lib/email';
import { createClient } from '@/app/lib/supabase/server';

export async function POST(request: Request) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { leadIds, customMessage } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds array is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user profile for agent info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', auth.user.id)
      .single();

    const agentName = profile?.full_name || 'Real Estate Agent';
    const agentEmail = profile?.email || '';
    const agentPhone = profile?.phone || '';

    // Get leads with email addresses
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, owner_name, email, property_address, email_text')
      .in('id', leadIds)
      .eq('user_id', auth.user.id);

    if (leadsError) {
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    // Filter leads that have email addresses
    const leadsWithEmail = leads?.filter(l => l.email) || [];

    if (leadsWithEmail.length === 0) {
      return NextResponse.json(
        { error: 'No leads with email addresses found' },
        { status: 400 }
      );
    }

    // Check DNC list for emails
    const emails = leadsWithEmail.map(l => l.email!.toLowerCase());
    const { data: dncEmails } = await supabase
      .from('dnc_list')
      .select('phone')
      .eq('user_id', auth.user.id)
      .in('phone', emails);

    const dncSet = new Set(dncEmails?.map(d => d.phone.toLowerCase()) || []);

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: auth.user.id,
        name: `Email Campaign - ${new Date().toLocaleDateString()}`,
        status: 'sending',
        template_name: 'outreach_email',
        total_leads: leadsWithEmail.length,
      })
      .select()
      .single();

    if (campaignError) {
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      );
    }

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Send emails
    for (const lead of leadsWithEmail) {
      // Check DNC
      if (dncSet.has(lead.email!.toLowerCase())) {
        results.skipped++;
        continue;
      }

      // Generate email content
      const emailContent = generateOutreachEmail({
        recipientName: lead.owner_name || 'Property Owner',
        propertyAddress: lead.property_address || 'your property',
        agentName,
        agentPhone,
        agentEmail,
        customMessage: lead.email_text || customMessage,
      });

      // Send email with agent branding
      const result = await sendEmail({
        to: lead.email!,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: agentEmail,
        fromName: agentName,
      });

      // Record message
      await supabase.from('messages').insert({
        user_id: auth.user.id,
        lead_id: lead.id,
        campaign_id: campaign.id,
        direction: 'outbound',
        channel: 'email',
        to_number: lead.email,
        body: emailContent.text,
        status: result.ok ? 'sent' : 'failed',
        external_id: result.messageId,
        error_message: result.error,
      });

      // Link to campaign
      await supabase.from('campaign_leads').insert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: result.ok ? 'sent' : 'failed',
        sent_at: result.ok ? new Date().toISOString() : null,
      });

      if (result.ok) {
        results.sent++;

        // Update lead last_contacted
        await supabase
          .from('leads')
          .update({ last_contacted: new Date().toISOString() })
          .eq('id', lead.id);
      } else {
        results.failed++;
        results.errors.push(`${lead.email}: ${result.error}`);
      }
    }

    // Update campaign stats
    await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        sent_count: results.sent,
        failed_count: results.failed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    // Log activity
    await logActivity(auth.user.id, 'email_campaign_sent', `Sent ${results.sent} emails`, 'success', {
      campaignId: campaign.id,
      ...results,
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      results,
    });
  } catch (error) {
    console.error('[Email Send] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    );
  }
}
