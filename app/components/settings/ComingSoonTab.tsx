'use client';

export default function ComingSoonTab() {
  return (
    <section className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-tools text-gray-400 dark:text-gray-500 text-2xl"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Coming Soon</h3>
        <p className="text-gray-500 dark:text-gray-400">
          This feature is under development and will be available soon.
        </p>
      </div>
    </section>
  );
}
