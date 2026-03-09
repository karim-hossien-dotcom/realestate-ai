import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Estate AI</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              AI-powered CRM for real estate agents.
            </p>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Legal</p>
              <ul className="space-y-1">
                <li>
                  <Link href="/privacy-policy" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Contact</p>
              <ul className="space-y-1">
                <li>
                  <a href="mailto:support@realestate-ai.app" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    support@realestate-ai.app
                  </a>
                </li>
                <li>
                  <a href="tel:+18484569428" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    (848) 456-9428
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            &copy; {new Date().getFullYear()} EYWA Consulting Services Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
