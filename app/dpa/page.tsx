export default function DpaPage() {
  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, color: '#e0e0e0', background: '#07070A' }}>
      <h1 style={{ color: '#fff' }}>Data Processing Agreement</h1>
      <p><strong>Effective Date:</strong> March 23, 2026</p>
      <p>This Data Processing Agreement (&quot;DPA&quot;) forms part of the Terms of Service between <strong>EYWA Consulting Services Inc</strong> (d/b/a Estate AI), the &quot;Processor&quot;, and the subscribing entity, the &quot;Controller&quot;, collectively the &quot;Parties&quot;.</p>

      <h2 style={{ color: '#fff' }}>1. Definitions</h2>
      <ul>
        <li><strong>&quot;Personal Data&quot;</strong> means any information relating to an identified or identifiable natural person processed by Estate AI on behalf of the Controller.</li>
        <li><strong>&quot;Processing&quot;</strong> means any operation performed on Personal Data, including collection, storage, use, disclosure, and deletion.</li>
        <li><strong>&quot;Sub-processor&quot;</strong> means a third-party service provider engaged by Estate AI to process Personal Data.</li>
        <li><strong>&quot;Data Breach&quot;</strong> means unauthorized access, acquisition, use, or disclosure of Personal Data.</li>
      </ul>

      <h2 style={{ color: '#fff' }}>2. Scope of Processing</h2>
      <p>Estate AI processes Personal Data solely to provide the services described in the Terms of Service, including:</p>
      <ul>
        <li>Storing and managing lead contact information (names, phone numbers, email addresses, property addresses).</li>
        <li>Sending and receiving messages via WhatsApp, SMS, and Email on behalf of the Controller.</li>
        <li>AI-assisted message generation, lead qualification, and follow-up scheduling.</li>
        <li>Analytics and reporting on communication activity.</li>
      </ul>
      <p>Estate AI will not process Personal Data for any purpose other than providing the contracted services, unless required by law.</p>

      <h2 style={{ color: '#fff' }}>3. Controller Obligations</h2>
      <p>The Controller warrants that:</p>
      <ul>
        <li>All Personal Data provided to Estate AI has been collected lawfully and with appropriate consent.</li>
        <li>The Controller has a valid legal basis for processing under applicable data protection laws (GDPR, CCPA, TCPA, CAN-SPAM).</li>
        <li>The Controller will maintain accurate Do Not Contact (DNC) lists and honor all opt-out requests.</li>
        <li>The Controller is responsible for the content of all messages sent through the platform.</li>
      </ul>

      <h2 style={{ color: '#fff' }}>4. Security Measures</h2>
      <p>Estate AI implements and maintains appropriate technical and organizational measures to protect Personal Data, including:</p>
      <ul>
        <li><strong>Encryption:</strong> Data encrypted in transit (TLS 1.2+) and at rest (AES-256).</li>
        <li><strong>Access Controls:</strong> Role-based access with Supabase Row Level Security (RLS) ensuring tenant isolation.</li>
        <li><strong>Authentication:</strong> Secure session management via Supabase Auth with cookie-based sessions.</li>
        <li><strong>Infrastructure:</strong> Hosted on Render (SOC 2 Type II compliant) with automated deployments and environment isolation.</li>
        <li><strong>Monitoring:</strong> Automated system health checks, rate limiting (60 req/min), and message deduplication.</li>
        <li><strong>API Security:</strong> All API routes require authentication. Webhook endpoints are signature-verified.</li>
      </ul>

      <h2 style={{ color: '#fff' }}>5. Sub-processors</h2>
      <p>Estate AI uses the following sub-processors to deliver the service. The Controller consents to the use of these sub-processors:</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#fff', fontSize: 13 }}>Sub-processor</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#fff', fontSize: 13 }}>Purpose</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#fff', fontSize: 13 }}>Location</th>
          </tr>
        </thead>
        <tbody style={{ fontSize: 13 }}>
          {[
            ['Supabase', 'Database, authentication, storage', 'US (AWS)'],
            ['Render', 'Application hosting and deployment', 'US (Oregon)'],
            ['OpenAI', 'AI message generation and lead analysis', 'US'],
            ['Meta (WhatsApp Business API)', 'WhatsApp message delivery', 'US/Global'],
            ['Twilio', 'SMS message delivery', 'US'],
            ['Resend', 'Email delivery', 'US'],
            ['Stripe', 'Payment processing and billing', 'US'],
          ].map(([name, purpose, loc]) => (
            <tr key={name} style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '8px 12px', color: '#ccc' }}>{name}</td>
              <td style={{ padding: '8px 12px', color: '#999' }}>{purpose}</td>
              <td style={{ padding: '8px 12px', color: '#999' }}>{loc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12 }}>
        Estate AI will notify the Controller of any new sub-processors at least 14 days before engagement. The Controller may object within that period.
      </p>

      <h2 style={{ color: '#fff' }}>6. Data Breach Notification</h2>
      <p>
        In the event of a Data Breach, Estate AI will:
      </p>
      <ul>
        <li>Notify the Controller without undue delay and no later than <strong>72 hours</strong> after becoming aware of the breach.</li>
        <li>Provide details including: nature of the breach, categories and approximate number of affected individuals, likely consequences, and measures taken or proposed to mitigate the breach.</li>
        <li>Cooperate with the Controller in investigating and remediating the breach.</li>
        <li>Maintain a record of all Data Breaches regardless of whether notification to the Controller is required.</li>
      </ul>

      <h2 style={{ color: '#fff' }}>7. Data Retention and Deletion</h2>
      <ul>
        <li>Personal Data is retained for the duration of the subscription and for 30 days after termination.</li>
        <li>Upon termination, the Controller may request a full data export within 30 days.</li>
        <li>After the 30-day post-termination period, all Personal Data will be permanently deleted from active systems within 30 additional days.</li>
        <li>Backups may retain data for up to 90 days after deletion from active systems, after which they are purged.</li>
      </ul>

      <h2 style={{ color: '#fff' }}>8. Data Subject Rights</h2>
      <p>
        Estate AI will assist the Controller in responding to data subject requests (access, correction, deletion, portability, restriction, objection) within the timeframes required by applicable law. The Controller is responsible for verifying the identity of data subjects making requests.
      </p>

      <h2 style={{ color: '#fff' }}>9. International Data Transfers</h2>
      <p>
        Personal Data is processed primarily in the United States. For transfers from the EEA/UK, Estate AI relies on Standard Contractual Clauses (SCCs) as approved by the European Commission. Copies of the applicable SCCs are available upon request.
      </p>

      <h2 style={{ color: '#fff' }}>10. Audit Rights</h2>
      <p>
        The Controller may, upon 30 days written notice and no more than once per year, request an audit of Estate AI&apos;s data processing practices. Estate AI will provide reasonable cooperation, including access to relevant documentation and personnel. Audits will be conducted during normal business hours and at the Controller&apos;s expense.
      </p>

      <h2 style={{ color: '#fff' }}>11. Term and Termination</h2>
      <p>
        This DPA remains in effect for the duration of the subscription agreement. It automatically terminates when all Personal Data has been deleted or returned. Obligations regarding data security and confidentiality survive termination.
      </p>

      <h2 style={{ color: '#fff' }}>12. Contact</h2>
      <ul>
        <li><strong>Data Protection Contact:</strong> privacy@realestate-ai.app</li>
        <li><strong>Company:</strong> EYWA Consulting Services Inc</li>
        <li><strong>Address:</strong> 700 1st St, Hoboken, NJ 07030</li>
      </ul>

      <p style={{ marginTop: 40, fontSize: 13, color: '#666' }}>
        This DPA was last updated on March 23, 2026. Changes will be communicated to active subscribers.
      </p>
    </main>
  );
}
