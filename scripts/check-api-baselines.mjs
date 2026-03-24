/**
 * API Response Time Baseline Check
 *
 * Run: node scripts/check-api-baselines.mjs
 *
 * Tests key API endpoints and reports response times.
 * Use to establish baselines and catch regressions.
 */

const BASE = process.env.APP_URL || 'https://realestate-ai.app';

const endpoints = [
  { method: 'GET', path: '/', name: 'Landing page', public: true },
  { method: 'GET', path: '/api/health', name: 'Health check', public: true },
  { method: 'GET', path: '/api/stripe/plans', name: 'Stripe plans', public: true },
];

async function measure(endpoint) {
  const url = `${BASE}${endpoint.path}`;
  const start = performance.now();

  try {
    const res = await fetch(url, {
      method: endpoint.method,
      headers: { 'User-Agent': 'EstateAI-Baseline-Check/1.0' },
      redirect: 'follow',
    });
    const elapsed = Math.round(performance.now() - start);
    return { ...endpoint, status: res.status, timeMs: elapsed, ok: res.ok };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { ...endpoint, status: 0, timeMs: elapsed, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`\n=== API Response Time Baselines ===`);
  console.log(`Target: ${BASE}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const results = [];
  for (const ep of endpoints) {
    const result = await measure(ep);
    results.push(result);

    const status = result.ok ? '✓' : '✗';
    const timeColor = result.timeMs < 500 ? '' : result.timeMs < 2000 ? ' ⚠' : ' ❌';
    console.log(`  ${status} ${result.name.padEnd(20)} ${String(result.timeMs).padStart(6)}ms  HTTP ${result.status}${timeColor}${result.error ? ` (${result.error})` : ''}`);
  }

  console.log(`\n--- Targets ---`);
  console.log(`  Landing page:  <500ms`);
  console.log(`  Health check:  <200ms`);
  console.log(`  API routes:    <1000ms`);
  console.log(`  Dashboard:     <2000ms`);

  const avg = Math.round(results.reduce((s, r) => s + r.timeMs, 0) / results.length);
  const slow = results.filter(r => r.timeMs > 2000);

  console.log(`\n  Average: ${avg}ms | Slow (>2s): ${slow.length}/${results.length}`);

  if (slow.length > 0) {
    console.log(`\n  ⚠ Slow endpoints:`);
    slow.forEach(r => console.log(`    - ${r.name}: ${r.timeMs}ms`));
  }
}

main().catch(console.error);
