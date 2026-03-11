import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';
import { geocodeAddress, getTravelMinutes } from '@/app/lib/maps';

const CheckAvailabilitySchema = z.object({
  proposed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proposed_time: z.string().regex(/^\d{2}:\d{2}$/),
  property_address: z.string().min(1),
  duration_minutes: z.number().int().min(15).max(480).default(30),
  travel_buffer_minutes: z.number().int().min(0).max(180).default(30),
});

type Conflict = {
  meeting_id: string;
  meeting_title: string;
  meeting_time: string;
  meeting_address: string | null;
  travel_time_minutes: number | null;
  gap_minutes: number;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await withAuth();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const parsed = CheckAvailabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      proposed_date,
      proposed_time,
      property_address,
      duration_minutes,
      travel_buffer_minutes,
    } = parsed.data;

    const supabase = await createClient();

    // Fetch all meetings on the proposed date for this user
    const dayStart = `${proposed_date}T00:00:00`;
    const dayEnd = `${proposed_date}T23:59:59`;

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, duration_minutes, property_address, latitude, longitude, location')
      .eq('user_id', auth.user.id)
      .gte('meeting_date', dayStart)
      .lte('meeting_date', dayEnd)
      .neq('status', 'cancelled')
      .order('meeting_date', { ascending: true });

    if (error) {
      console.error('Error fetching meetings:', error);
      return NextResponse.json({ ok: false, error: 'Failed to fetch meetings' }, { status: 500 });
    }

    if (!meetings || meetings.length === 0) {
      return NextResponse.json({
        ok: true,
        available: true,
        conflicts: [],
        suggested_times: [],
        geocode: await geocodeAddress(property_address),
      });
    }

    // Parse proposed datetime
    const proposedStart = new Date(`${proposed_date}T${proposed_time}:00`);
    const proposedEnd = new Date(proposedStart.getTime() + duration_minutes * 60_000);

    const conflicts: Conflict[] = [];

    for (const meeting of meetings) {
      const meetingStart = new Date(meeting.meeting_date);
      const meetingDuration = meeting.duration_minutes || 30;
      const meetingEnd = new Date(meetingStart.getTime() + meetingDuration * 60_000);

      // Calculate gap between proposed and existing
      const gapBefore = (proposedStart.getTime() - meetingEnd.getTime()) / 60_000;
      const gapAfter = (meetingStart.getTime() - proposedEnd.getTime()) / 60_000;
      const gap = Math.max(gapBefore, gapAfter);

      // If meetings overlap directly
      if (proposedStart < meetingEnd && proposedEnd > meetingStart) {
        conflicts.push({
          meeting_id: meeting.id,
          meeting_title: meeting.title || 'Untitled',
          meeting_time: meetingStart.toTimeString().slice(0, 5),
          meeting_address: meeting.property_address || meeting.location || null,
          travel_time_minutes: null,
          gap_minutes: Math.round(gap),
        });
        continue;
      }

      // Check travel time if addresses are available
      const existingAddress = meeting.property_address || meeting.location;
      let travelMinutes: number | null = null;

      if (existingAddress && property_address) {
        travelMinutes = await getTravelMinutes(existingAddress, property_address);
      }

      const requiredBuffer = travelMinutes
        ? Math.max(travelMinutes, travel_buffer_minutes)
        : travel_buffer_minutes;

      // Check if gap is sufficient for travel
      if (Math.abs(gap) < requiredBuffer) {
        conflicts.push({
          meeting_id: meeting.id,
          meeting_title: meeting.title || 'Untitled',
          meeting_time: meetingStart.toTimeString().slice(0, 5),
          meeting_address: existingAddress || null,
          travel_time_minutes: travelMinutes,
          gap_minutes: Math.round(gap),
        });
      }
    }

    // Generate suggested times if there are conflicts
    const suggested_times: string[] = [];
    if (conflicts.length > 0) {
      const slots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
      for (const slot of slots) {
        if (slot === proposed_time) continue;
        const slotStart = new Date(`${proposed_date}T${slot}:00`);
        const slotEnd = new Date(slotStart.getTime() + duration_minutes * 60_000);

        const hasConflict = meetings.some(m => {
          const mStart = new Date(m.meeting_date);
          const mEnd = new Date(mStart.getTime() + (m.duration_minutes || 30) * 60_000);
          return slotStart < mEnd && slotEnd > mStart;
        });

        if (!hasConflict && suggested_times.length < 3) {
          suggested_times.push(slot);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      available: conflicts.length === 0,
      conflicts,
      suggested_times,
      geocode: await geocodeAddress(property_address),
    });
  } catch (err) {
    console.error('check-availability error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
