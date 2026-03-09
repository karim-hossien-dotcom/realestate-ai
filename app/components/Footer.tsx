import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] dark:bg-[#0A0D16] py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-6">
          <div>
            <p className="text-sm font-heading font-semibold text-[var(--text-primary)]">Estate AI</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              AI-powered CRM for real estate agents.
            </p>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Legal</p>
              <ul className="space-y-1">
                <li>
                  <Link href="/privacy-policy" className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Contact</p>
              <ul className="space-y-1">
                <li>
                  <a href="mailto:support@realestate-ai.app" className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                    support@realestate-ai.app
                  </a>
                </li>
                <li>
                  <a href="tel:+18484569428" className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                    (848) 456-9428
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <p className="text-center text-xs text-[var(--text-secondary)]">
            &copy; {new Date().getFullYear()} EYWA Consulting Services Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
