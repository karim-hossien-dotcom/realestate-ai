import { NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/server';

const startedAt = new Date().toISOString();

/**
 * GET /api/health
 * Returns service health including DB connectivity check.
 * No auth required — used by Render monitoring.
 */
export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Check Supabase DB connectivity
  const dbStart = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    checks.database = error
      ? { status: 'unhealthy', error: error.message, latency_ms: Date.now() - dbStart }
      : { status: 'healthy', latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Unknown error',
      latency_ms: Date.now() - dbStart,
    };
  }

  // Check required env vars presence (not values)
  const requiredEnvs = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'RESEND_API_KEY',
  ];
  const missingEnvs = requiredEnvs.filter((key) => !process.env[key]);
  checks.config = missingEnvs.length > 0
    ? { status: 'degraded', error: `Missing: ${missingEnvs.join(', ')}` }
    : { status: 'healthy' };

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'estate-ai-node',
    version: process.env.npm_package_version || '0.2.0',
    started_at: startedAt,
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allHealthy ? 200 : 503 });
}
