"""
Supabase database client for Python webhook service
"""
import logging
import os
from supabase import create_client, Client
from typing import Optional

logger = logging.getLogger(__name__)


def get_supabase_client() -> Optional[Client]:
    """
    Get a Supabase client using service role key (bypasses RLS)
    """
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        logger.warning("Supabase credentials not configured")
        return None

    return create_client(url, key)


def log_inbound_message(
    user_id: str,
    from_number: str,
    body: str,
    external_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    channel: str = "whatsapp",
) -> bool:
    """
    Log an inbound message to the messages table
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("messages").insert({
            "user_id": user_id,
            "lead_id": lead_id,
            "direction": "inbound",
            "channel": channel,
            "from_number": from_number,
            "body": body,
            "status": "received",
            "external_id": external_id,
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Error logging inbound message: {e}")
        return False


def log_outbound_message(
    user_id: str,
    to_number: str,
    body: str,
    status: str = "sent",
    external_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    error_message: Optional[str] = None,
    channel: str = "whatsapp",
) -> bool:
    """
    Log an outbound message to the messages table
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("messages").insert({
            "user_id": user_id,
            "lead_id": lead_id,
            "direction": "outbound",
            "channel": channel,
            "to_number": to_number,
            "body": body,
            "status": status,
            "external_id": external_id,
            "error_message": error_message,
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Error logging outbound message: {e}")
        return False


def add_to_dnc_list(user_id: str, phone: str, reason: str = "STOP keyword") -> bool:
    """
    Add a phone number to the DNC (Do Not Call) list
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        # Upsert to handle duplicates gracefully
        client.table("dnc_list").upsert({
            "user_id": user_id,
            "phone": phone,
            "reason": reason,
            "source": "webhook_stop",
        }, on_conflict="user_id,phone").execute()
        return True
    except Exception as e:
        logger.error(f"Error adding to DNC list: {e}")
        return False


def log_activity(
    user_id: str,
    event_type: str,
    description: str,
    status: str = "success",
    metadata: Optional[dict] = None,
) -> bool:
    """
    Log an activity event
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("activity_logs").insert({
            "user_id": user_id,
            "event_type": event_type,
            "description": description,
            "status": status,
            "metadata": metadata,
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        return False


def find_lead_by_phone(user_id: str, phone: str) -> Optional[dict]:
    """
    Find a lead by phone number
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Normalize phone — strip all non-digit chars for reliable matching
        digits = "".join(c for c in phone if c.isdigit())
        if not digits:
            return None

        result = client.table("leads").select("*").eq(
            "user_id", user_id
        ).like("phone", f"%{digits}").order(
            "last_response", desc=True        ).order(
            "updated_at", desc=True        ).limit(1).execute()

        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Error finding lead: {e}")
        return None


def update_lead_last_response(lead_id: str) -> bool:
    """
    Update the last_response timestamp on a lead
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        from datetime import datetime, timezone

        client.table("leads").update({
            "last_response": datetime.now(timezone.utc).isoformat(),
        }).eq("id", lead_id).execute()

        # Also trigger score update via RPC
        client.rpc("update_lead_score", {"p_lead_id": lead_id}).execute()

        return True
    except Exception as e:
        logger.error(f"Error updating lead: {e}")
        return False


def create_meeting(
    user_id: str,
    title: str,
    lead_phone: str,
    lead_name: Optional[str] = None,
    lead_id: Optional[str] = None,
    description: Optional[str] = None,
    meeting_date: Optional[str] = None,
    property_address: Optional[str] = None,
    notes: Optional[str] = None,
    source: str = "ai_bot",
) -> bool:
    """
    Create a meeting/appointment record
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        record = {
            "user_id": user_id,
            "title": title,
            "lead_phone": lead_phone,
            "source": source,
        }
        if lead_id:
            record["lead_id"] = lead_id
        if lead_name:
            record["lead_name"] = lead_name
        if description:
            record["description"] = description
        if meeting_date:
            record["meeting_date"] = meeting_date
        if property_address:
            record["property_address"] = property_address
        if notes:
            record["notes"] = notes

        client.table("meetings").insert(record).execute()
        return True
    except Exception as e:
        logger.error(f"Error creating meeting: {e}")
        return False


def create_follow_up(
    user_id: str,
    lead_id: str,
    message_text: str,
    scheduled_at: str,
    channel: str = "both",
) -> bool:
    """
    Create a follow-up reminder in the follow_ups table.
    Deduplicates: skips if a pending follow-up already exists for this lead at this time.
    Table columns: id, user_id, lead_id, message_text, scheduled_at, status, sent_at, created_at
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        # Check for existing pending follow-up for same lead + scheduled time
        existing = (
            client.table("follow_ups")
            .select("id")
            .eq("lead_id", lead_id)
            .eq("scheduled_at", scheduled_at)
            .eq("status", "pending")
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            logger.debug(f"Follow-up already exists for lead {lead_id} at {scheduled_at}, skipping")
            return True

        record = {
            "user_id": user_id,
            "lead_id": lead_id,
            "message_text": message_text,
            "scheduled_at": scheduled_at,
            "status": "pending",
        }
        client.table("follow_ups").insert(record).execute()
        return True
    except Exception as e:
        logger.error(f"Error creating follow-up: {e}")
        return False


def get_conversation_history(user_id: str, phone: str, limit: int = 20) -> list:
    """
    Fetch recent conversation messages for a phone number.
    Returns list of {direction, body, created_at} dicts, oldest first.
    Searches by lead_id first, then falls back to phone number matching
    (handles messages that were stored with lead_id=null).
    """
    client = get_supabase_client()
    if not client:
        return []

    try:
        lead = find_lead_by_phone(user_id, phone)

        # Strategy 1: query by lead_id (most reliable when lead_id is set)
        lead_messages = []
        if lead:
            result = (
                client.table("messages")
                .select("direction, body, channel, created_at, from_number, to_number, campaign_id")
                .eq("user_id", user_id)
                .eq("lead_id", lead["id"])
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            lead_messages = result.data if result.data else []

        # Strategy 2: also find messages by phone number (catches null lead_id rows)
        digits = "".join(c for c in phone if c.isdigit())
        phone_messages = []
        if digits:
            # Match inbound (from_number) and outbound (to_number) by phone digits
            result_in = (
                client.table("messages")
                .select("direction, body, channel, created_at, from_number, to_number, campaign_id")
                .eq("user_id", user_id)
                .like("from_number", f"%{digits}")
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            result_out = (
                client.table("messages")
                .select("direction, body, channel, created_at, from_number, to_number, campaign_id")
                .eq("user_id", user_id)
                .like("to_number", f"%{digits}")
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            phone_messages = (result_in.data or []) + (result_out.data or [])

        # Merge and deduplicate by created_at + direction
        seen = set()
        merged = []
        for msg in lead_messages + phone_messages:
            key = (msg["created_at"], msg["direction"])
            if key not in seen:
                seen.add(key)
                merged.append(msg)

        # Sort by time, oldest first, return last N
        merged.sort(key=lambda m: m["created_at"])
        return merged[-limit:]
    except Exception as e:
        logger.error(f"Error fetching conversation history: {e}")
        return []


def get_campaign_names(user_id: str, campaign_ids: list) -> dict:
    """
    Fetch campaign names for a list of campaign IDs.
    Returns {campaign_id: campaign_name} dict.
    """
    client = get_supabase_client()
    if not client or not campaign_ids:
        return {}
    try:
        result = (
            client.table("campaigns")
            .select("id, name")
            .eq("user_id", user_id)
            .in_("id", campaign_ids)
            .execute()
        )
        return {c["id"]: c["name"] for c in (result.data or [])}
    except Exception as e:
        logger.error(f"Error fetching campaign names: {e}")
        return {}


def get_lead_details(user_id: str, phone: str) -> Optional[dict]:
    """
    Get full lead details including property info, budget, etc.
    """
    lead = find_lead_by_phone(user_id, phone)
    if not lead:
        return None
    return lead


def is_on_dnc_list(user_id: str, phone: str) -> bool:
    """
    Check if a phone number is on the DNC (Do Not Contact) list.
    Returns True if the number should NOT be contacted.
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        digits = "".join(c for c in phone if c.isdigit())
        if not digits:
            return False

        result = client.table("dnc_list").select("id").eq(
            "user_id", user_id
        ).like("phone", f"%{digits}").limit(1).execute()

        return bool(result.data)
    except Exception as e:
        logger.error(f"Error checking DNC list: {e}")
        return False


def remove_from_dnc_list(user_id: str, phone: str) -> bool:
    """
    Remove a phone number from the DNC list (re-opt-in).
    Used when a previously opted-out lead re-engages.
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        digits = "".join(c for c in phone if c.isdigit())
        if not digits:
            return False

        client.table("dnc_list").delete().eq(
            "user_id", user_id
        ).like("phone", f"%{digits}").execute()
        return True
    except Exception as e:
        logger.error(f"Error removing from DNC list: {e}")
        return False


def get_default_user_id() -> Optional[str]:
    """
    DEPRECATED: Returns first user from profiles table. Only valid for single-user setups.
    Use find_user_by_lead_phone() or _resolve_user_context() for multi-tenant routing.
    """
    import warnings
    warnings.warn(
        "get_default_user_id() is deprecated — use find_user_by_lead_phone() for multi-tenant routing",
        DeprecationWarning,
        stacklevel=2,
    )
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.table("profiles").select("id").limit(1).execute()
        if result.data:
            return result.data[0]["id"]
        return None
    except Exception as e:
        logger.error(f"Error getting default user: {e}")
        return None


def find_user_by_lead_phone(phone: str) -> Optional[dict]:
    """
    Search leads across ALL users (no user_id filter) to find which agent owns this lead.
    Returns {"user_id": ..., "lead": {...}} or None.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Normalize phone — strip all non-digit chars for reliable matching
        digits = "".join(c for c in phone if c.isdigit())
        if not digits:
            return None

        result = client.table("leads").select("*").like(
            "phone", f"%{digits}"
        ).order("last_response", desc=True).order(
            "updated_at", desc=True        ).limit(1).execute()

        if result.data:
            lead = result.data[0]
            return {"user_id": lead.get("user_id"), "lead": lead}
        return None
    except Exception as e:
        logger.error(f"Error finding user by lead phone: {e}")
        return None


def get_user_profile(user_id: str) -> Optional[dict]:
    """
    Fetch a user's profile (full_name, company, phone, email).
    Returns dict or None.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.table("profiles").select(
            "id, full_name, company, phone, email"
        ).eq("id", user_id).limit(1).execute()

        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        return None


def check_meeting_availability(
    user_id: str,
    proposed_date: str,
    proposed_time: str,
    duration_minutes: int = 30,
) -> dict:
    """
    Check if a proposed meeting time conflicts with existing meetings on the same day.
    Returns {"available": bool, "conflicts": [{"title", "time", "address"}]}.
    """
    client = get_supabase_client()
    if not client:
        return {"available": True, "conflicts": []}

    try:
        day_start = f"{proposed_date}T00:00:00"
        day_end = f"{proposed_date}T23:59:59"

        result = client.table("meetings").select(
            "id, title, meeting_date, duration_minutes, property_address, location"
        ).eq("user_id", user_id).gte(
            "meeting_date", day_start
        ).lte(
            "meeting_date", day_end
        ).neq("status", "cancelled").execute()

        meetings = result.data or []
        if not meetings:
            return {"available": True, "conflicts": []}

        from datetime import datetime

        proposed_dt = datetime.fromisoformat(f"{proposed_date}T{proposed_time}:00")
        proposed_end = datetime.fromisoformat(
            f"{proposed_date}T{proposed_time}:00"
        )
        from datetime import timedelta
        proposed_end = proposed_dt + timedelta(minutes=duration_minutes)

        conflicts = []
        for m in meetings:
            m_start = datetime.fromisoformat(m["meeting_date"].replace("Z", "+00:00").replace("+00:00", ""))
            m_dur = m.get("duration_minutes") or 30
            m_end = m_start + timedelta(minutes=m_dur)

            # Check overlap (with 30 min buffer)
            buffer = timedelta(minutes=30)
            if proposed_dt < (m_end + buffer) and proposed_end > (m_start - buffer):
                conflicts.append({
                    "title": m.get("title", "Meeting"),
                    "time": m_start.strftime("%H:%M"),
                    "address": m.get("property_address") or m.get("location") or "",
                })

        return {"available": len(conflicts) == 0, "conflicts": conflicts}
    except Exception as e:
        logger.error(f"Error checking meeting availability: {e}")
        return {"available": True, "conflicts": []}


def get_user_ai_config(user_id: str) -> Optional[dict]:
    """
    Fetch a user's AI script configuration from ai_config table.
    Returns dict with tone, language, property_focus, etc. or None.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.table("ai_config").select("*").eq(
            "user_id", user_id
        ).eq("active", True).limit(1).execute()

        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Error getting user AI config: {e}")
        return None


def record_overage(user_id: str, channel: str, period_start: str, count: int = 1) -> bool:
    """
    Record overage usage for a given channel.
    Upserts into usage_records, incrementing the appropriate counter.
    """
    column_map = {
        "sms": "overage_sms",
        "email": "overage_email",
        "whatsapp": "overage_whatsapp",
        "leads": "overage_leads",
    }
    column = column_map.get(channel)
    if not column:
        return False

    client = get_supabase_client()
    if not client:
        return False

    try:
        # Check for existing record
        result = client.table("usage_records").select(
            f"id, {column}"
        ).eq("user_id", user_id).eq(
            "period_start", period_start
        ).limit(1).execute()

        if result.data:
            existing = result.data[0]
            current_val = existing.get(column, 0) or 0
            client.table("usage_records").update(
                {column: current_val + count}
            ).eq("id", existing["id"]).execute()
        else:
            client.table("usage_records").insert({
                "user_id": user_id,
                "period_start": period_start,
                column: count,
                "overage_reported": False,
            }).execute()
        return True
    except Exception as e:
        logger.error(f"Error recording overage: {e}")
        return False


def get_user_plan_slug(user_id: str) -> Optional[str]:
    """
    Get the plan slug for a user. Returns 'starter', 'pro', 'agency', or None.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.table("subscriptions").select(
            "*, plans(slug)"
        ).eq("user_id", user_id).in_(
            "status", ["active", "trialing"]
        ).order("created_at", desc=True).limit(1).execute()

        if not result.data:
            return None

        plans = result.data[0].get("plans")
        if isinstance(plans, dict):
            return plans.get("slug")
        return None
    except Exception as e:
        logger.error(f"Error getting user plan slug: {e}")
        return None


def check_messaging_quota(user_id: str) -> dict:
    """
    Check if a user has remaining messaging quota.
    Returns {"allowed": bool, "remaining": int, "limit": int, "current": int}.
    If no subscription found, allows by default (don't block inbound AI responses).
    """
    client = get_supabase_client()
    if not client:
        return {"allowed": True, "remaining": 999, "limit": -1, "current": 0}

    try:
        # Get active subscription + plan
        result = client.table("subscriptions").select(
            "*, plans(*)"
        ).eq("user_id", user_id).in_(
            "status", ["active", "trialing"]
        ).order("created_at", desc=True).limit(1).execute()

        if not result.data:
            # No subscription — allow (don't block AI responses for unsubscribed users)
            return {"allowed": True, "remaining": 999, "limit": -1, "current": 0}

        sub = result.data[0]
        plan = sub.get("plans", {})
        limit = plan.get("included_sms", 0)

        # Unlimited
        if limit == -1:
            return {"allowed": True, "remaining": 999999, "limit": -1, "current": 0}

        # Count all outbound messages this billing period (shared pool)
        from datetime import datetime
        period_start = sub.get("current_period_start")
        if period_start:
            period_iso = period_start
        else:
            now = datetime.utcnow()
            period_iso = datetime(now.year, now.month, 1).isoformat()

        count_result = client.table("messages").select(
            "id", count="exact"
        ).eq("user_id", user_id).eq(
            "direction", "outbound"
        ).gte("created_at", period_iso).execute()

        current = count_result.count if count_result.count else 0
        remaining = max(limit - current, 0)

        return {
            "allowed": current < limit,
            "remaining": remaining,
            "limit": limit,
            "current": current,
            "period_start": period_iso,
        }
    except Exception as e:
        logger.error(f"Error checking messaging quota: {e}")
        # On error, allow (don't block inbound responses)
        return {"allowed": True, "remaining": 999, "limit": -1, "current": 0}
