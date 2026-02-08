"""
Supabase database client for Python webhook service
"""
import os
from supabase import create_client, Client
from typing import Optional


def get_supabase_client() -> Optional[Client]:
    """
    Get a Supabase client using service role key (bypasses RLS)
    """
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("Warning: Supabase credentials not configured")
        return None

    return create_client(url, key)


def log_inbound_message(
    user_id: str,
    from_number: str,
    body: str,
    external_id: Optional[str] = None,
    lead_id: Optional[str] = None,
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
            "channel": "whatsapp",
            "from_number": from_number,
            "body": body,
            "status": "received",
            "external_id": external_id,
        }).execute()
        return True
    except Exception as e:
        print(f"Error logging inbound message: {e}")
        return False


def log_outbound_message(
    user_id: str,
    to_number: str,
    body: str,
    status: str = "sent",
    external_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    error_message: Optional[str] = None,
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
            "channel": "whatsapp",
            "to_number": to_number,
            "body": body,
            "status": status,
            "external_id": external_id,
            "error_message": error_message,
        }).execute()
        return True
    except Exception as e:
        print(f"Error logging outbound message: {e}")
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
        print(f"Error adding to DNC list: {e}")
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
        print(f"Error logging activity: {e}")
        return False


def find_lead_by_phone(user_id: str, phone: str) -> Optional[dict]:
    """
    Find a lead by phone number
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Normalize phone (remove + prefix)
        normalized = phone.lstrip("+")

        result = client.table("leads").select("*").eq(
            "user_id", user_id
        ).or_(
            f"phone.eq.{normalized},phone.eq.+{normalized}"
        ).limit(1).execute()

        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Error finding lead: {e}")
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
        print(f"Error updating lead: {e}")
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
        print(f"Error creating meeting: {e}")
        return False


def create_follow_up(
    user_id: str,
    lead_id: str,
    message_text: str,
    scheduled_at: str,
    channel: str = "both",
) -> bool:
    """
    Create a follow-up reminder in the follow_ups table
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        record = {
            "user_id": user_id,
            "lead_id": lead_id,
            "message_text": message_text,
            "scheduled_at": scheduled_at,
            "status": "pending",
            "channel": channel,
        }
        client.table("follow_ups").insert(record).execute()
        return True
    except Exception as e:
        # If channel column doesn't exist yet (migration not run), retry without it
        if "channel" in str(e):
            try:
                record = {
                    "user_id": user_id,
                    "lead_id": lead_id,
                    "message_text": message_text,
                    "scheduled_at": scheduled_at,
                    "status": "pending",
                }
                client.table("follow_ups").insert(record).execute()
                return True
            except Exception as e2:
                print(f"Error creating follow-up (retry): {e2}")
                return False
        print(f"Error creating follow-up: {e}")
        return False


def get_conversation_history(user_id: str, phone: str, limit: int = 20) -> list:
    """
    Fetch recent conversation messages for a phone number.
    Returns list of {direction, body, created_at} dicts, oldest first.
    """
    client = get_supabase_client()
    if not client:
        return []

    try:
        normalized = phone.lstrip("+")

        # Find lead by phone to get lead_id
        lead = find_lead_by_phone(user_id, phone)
        if not lead:
            return []

        result = (
            client.table("messages")
            .select("direction, body, channel, created_at")
            .eq("user_id", user_id)
            .eq("lead_id", lead["id"])
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )

        return result.data if result.data else []
    except Exception as e:
        print(f"Error fetching conversation history: {e}")
        return []


def get_lead_details(user_id: str, phone: str) -> Optional[dict]:
    """
    Get full lead details including property info, budget, etc.
    """
    lead = find_lead_by_phone(user_id, phone)
    if not lead:
        return None
    return lead


def get_default_user_id() -> Optional[str]:
    """
    Get the first user ID from profiles table (for single-user setups)
    In production, you'd want to map phone numbers to specific users
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        result = client.table("profiles").select("id").limit(1).execute()
        if result.data:
            return result.data[0]["id"]
        return None
    except Exception as e:
        print(f"Error getting default user: {e}")
        return None
