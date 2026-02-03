export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px" }}>
      <h1>Privacy Policy</h1>
      <p>
        This application is used to communicate with users via WhatsApp on behalf
        of a real estate agent.
      </p>

      <h2>Information Collected:</h2>
      <ul>
        <li>Phone numbers</li>
        <li>Message content sent by users</li>
      </ul>

      <h2>How Information Is Used:</h2>
      <ul>
        <li>To respond to inbound messages</li>
        <li>To provide real estate-related information</li>
      </ul>

      <h2>Data Storage:</h2>
      <ul>
        <li>Messages may be logged for operational and debugging purposes.</li>
        <li>Data is not sold or shared with third parties.</li>
      </ul>

      <h2>User Control:</h2>
      <p>Users may opt out at any time by sending STOP.</p>

      <h2>Contact:</h2>
      <p>For questions, contact: support@yourdomain.com</p>
    </main>
  );
}
