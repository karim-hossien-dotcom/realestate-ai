export default function SmsConsentPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#222" }}>
      <h1>SMS Consent &amp; Opt-In Information</h1>
      <p><strong>Program Name:</strong> Estate AI Real Estate Outreach</p>
      <p><strong>Company:</strong> EYWA Consulting Services Inc (d/b/a Estate AI)</p>
      <p><strong>Last Updated:</strong> March 31, 2026</p>

      <hr style={{ margin: "24px 0" }} />

      <h2>How End Users Opt In to Receive SMS Messages</h2>
      <p>
        Estate AI is a SaaS platform used by licensed real estate agents to communicate with
        property owners and leads via SMS. End users (message recipients) are NOT direct customers
        of Estate AI — they are clients and leads of licensed real estate agents who use the platform.
      </p>
      <p>
        Consent is collected through the following methods, each documented in our system with a
        timestamp, consent type, and source:
      </p>

      <h3>Method 1: Web Form Opt-In</h3>
      <p>
        Agents using Estate AI can embed a property inquiry widget on their own websites.
        The form collects the prospect&apos;s name, phone number, and property interest.
        Before submission, the user must check a consent checkbox with the following disclosure:
      </p>
      <blockquote style={{ borderLeft: "3px solid #0066cc", padding: "12px 16px", background: "#f5f9ff", margin: "16px 0" }}>
        &quot;By providing your phone number, you consent to receive SMS/MMS messages from
        [Agent Name] via Estate AI regarding real estate opportunities. Message frequency varies.
        Message and data rates may apply. Reply STOP to opt out.
        <br /><br />
        <a href="https://realestate-ai.app/terms">Terms</a> | <a href="https://realestate-ai.app/privacy-policy">Privacy Policy</a>&quot;
      </blockquote>
      <p>
        Upon form submission, the system sends an opt-in confirmation message:
      </p>
      <blockquote style={{ borderLeft: "3px solid #28a745", padding: "12px 16px", background: "#f5fff7", margin: "16px 0" }}>
        &quot;Thanks for connecting with [Agent Name]! You&apos;ll receive updates about real estate
        opportunities. Reply STOP to opt out. Msg&amp;data rates may apply.&quot;
      </blockquote>

      <h3>Method 2: Inbound Text (Conversational)</h3>
      <p>
        Property owners initiate contact by texting the agent&apos;s business phone number directly.
        This constitutes implied consent for conversational messaging. The first automated reply
        includes the disclosure:
      </p>
      <blockquote style={{ borderLeft: "3px solid #28a745", padding: "12px 16px", background: "#f5fff7", margin: "16px 0" }}>
        &quot;Automated reply from [Agent Name]&apos;s AI assistant at [Brokerage].
        Msg&amp;data rates may apply. Reply STOP to opt out.&quot;
      </blockquote>

      <h3>Method 3: Direct Agent Contact (Verbal/In-Person)</h3>
      <p>
        Licensed real estate agents collect phone numbers during in-person meetings,
        phone calls, open houses, or networking events. The agent verbally discloses:
      </p>
      <blockquote style={{ borderLeft: "3px solid #0066cc", padding: "12px 16px", background: "#f5f9ff", margin: "16px 0" }}>
        &quot;I use an AI-assisted messaging platform called Estate AI to stay in touch with clients.
        You may receive text messages about real estate opportunities. Message and data rates may apply.
        You can opt out at any time by replying STOP.&quot;
      </blockquote>
      <p>
        Consent is recorded in the Estate AI platform with: timestamp, agent ID, lead phone number,
        consent source (&quot;verbal&quot; or &quot;in_person&quot;), and the agent&apos;s attestation
        that disclosure was provided. Each agent agrees to the consent collection requirements in
        our <a href="https://realestate-ai.app/terms">Terms of Service (Section 9.2)</a>.
      </p>

      <h3>Method 4: CRM Import with Prior Consent</h3>
      <p>
        Agents import lead lists from their existing CRM systems (e.g., Follow Up Boss, KVCore)
        where consent was previously obtained through the agent&apos;s own opt-in processes.
        Upon import, the agent attests that prior consent was obtained for each contact.
        Estate AI records a consent entry for each phone number with source &quot;csv_import&quot;
        and the importing agent&apos;s ID.
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>Brand Identification</h2>
      <p>
        All outbound messages identify the sending agent by name and brokerage. Example:
      </p>
      <blockquote style={{ borderLeft: "3px solid #666", padding: "12px 16px", background: "#f9f9f9", margin: "16px 0" }}>
        &quot;Hi John, it&apos;s Nadine Khalil from KW Commercial. We recently sold a building near
        your property at 123 Main St...&quot;
      </blockquote>

      <h2>Message Frequency</h2>
      <p>
        Message frequency varies based on engagement. Typical: <strong>1-4 messages per month</strong> for
        marketing and follow-ups. Conversational messages (replies to inbound texts) may be more frequent
        during active discussions.
      </p>

      <h2>Message and Data Rates</h2>
      <p>
        Message and data rates may apply depending on your mobile carrier and plan.
        Contact your wireless carrier for details.
      </p>

      <h2>Opt-Out</h2>
      <p>
        Recipients can opt out at any time by replying <strong>STOP</strong>, UNSUBSCRIBE, CANCEL, END,
        or QUIT to any message. Upon opt-out:
      </p>
      <ol>
        <li>A single confirmation is sent: &quot;You&apos;re unsubscribed. You won&apos;t receive any further messages. Thank you.&quot;</li>
        <li>The phone number is immediately added to our Do Not Contact list</li>
        <li>No further messages are sent from any agent on the platform</li>
      </ol>

      <h2>Help</h2>
      <p>
        Reply <strong>HELP</strong> to any message for assistance, or contact:
      </p>
      <ul>
        <li>Email: <a href="mailto:support@realestate-ai.app">support@realestate-ai.app</a></li>
        <li>Phone: (848) 456-9428</li>
      </ul>

      <h2>Links</h2>
      <ul>
        <li><a href="https://realestate-ai.app/terms">Terms and Conditions</a></li>
        <li><a href="https://realestate-ai.app/privacy-policy">Privacy Policy</a></li>
      </ul>

      <hr style={{ margin: "24px 0" }} />
      <p style={{ fontSize: "0.85em", color: "#666" }}>
        EYWA Consulting Services Inc (d/b/a Estate AI) | support@realestate-ai.app | (848) 456-9428
      </p>
    </main>
  );
}
