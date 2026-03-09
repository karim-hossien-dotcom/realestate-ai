import Link from 'next/link';

export default function CookiePolicyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1>Cookie Policy</h1>
      <p><strong>Effective Date:</strong> March 2026</p>
      <p><strong>Company:</strong> EYWA Consulting Services Inc (d/b/a Estate AI)</p>

      <h2>What Are Cookies</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. They help
        the site function properly, remember your preferences, and understand how you use the site.
      </p>

      <h2>Cookies We Use</h2>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
            <th style={{ padding: "8px 12px" }}>Cookie</th>
            <th style={{ padding: "8px 12px" }}>Type</th>
            <th style={{ padding: "8px 12px" }}>Purpose</th>
            <th style={{ padding: "8px 12px" }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 14 }}>sb-*</td>
            <td style={{ padding: "8px 12px" }}>Essential</td>
            <td style={{ padding: "8px 12px" }}>Supabase authentication and session management</td>
            <td style={{ padding: "8px 12px" }}>Session</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 14 }}>cookie-consent</td>
            <td style={{ padding: "8px 12px" }}>Essential</td>
            <td style={{ padding: "8px 12px" }}>Stores your cookie preference</td>
            <td style={{ padding: "8px 12px" }}>1 year</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 14 }}>__stripe_*</td>
            <td style={{ padding: "8px 12px" }}>Payment</td>
            <td style={{ padding: "8px 12px" }}>Stripe fraud prevention and payment processing</td>
            <td style={{ padding: "8px 12px" }}>Session</td>
          </tr>
        </tbody>
      </table>

      <h2>Essential Cookies</h2>
      <p>
        These cookies are necessary for Estate AI to function. They enable authentication,
        session management, and security features. You cannot opt out of essential cookies as
        the application would not work without them.
      </p>

      <h2>Payment Cookies</h2>
      <p>
        When you subscribe to a plan, Stripe sets cookies to process payments securely and
        prevent fraud. These cookies are only set during the checkout process.
      </p>

      <h2>Managing Cookies</h2>
      <ul>
        <li><strong>Cookie consent banner</strong> — Choose &quot;Essential Only&quot; when prompted to disable non-essential cookies.</li>
        <li><strong>Browser settings</strong> — Most browsers allow you to block or delete cookies. See your browser&apos;s help documentation for instructions.</li>
        <li><strong>Clear cookies</strong> — You can delete all cookies at any time through your browser settings. Note that this will sign you out of Estate AI.</li>
      </ul>

      <h2>More Information</h2>
      <p>
        For details on how we handle your data, see our{' '}
        <Link href="/privacy-policy">Privacy Policy</Link>.
        If you have questions about our use of cookies, contact us at{' '}
        <a href="mailto:privacy@realestate-ai.app">privacy@realestate-ai.app</a>.
      </p>

      <p style={{ marginTop: 40, fontSize: 14, color: "#666" }}>
        This policy may be updated from time to time. Changes will be posted on this page
        with an updated effective date.
      </p>
    </main>
  );
}
