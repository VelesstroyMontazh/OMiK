/**
 * Health Check API Endpoint for Next.js
 * Returns service status and connectivity to backend
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function checkBackendHealth(): Promise<{ ok: boolean; latency?: number; error?: string }> {
  const backendUrl = process.env.EXCEL_SERVICE_URL || 'http://127.0.0.1:3031';
  
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.OMIK_API_SECRET || ''}`,
      },
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return { ok: false, error: `Backend returned ${response.status}` };
    }
    
    const data = await response.json();
    return { ok: true, latency };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: errorMessage };
  }
}

export async function GET() {
  const [backendHealth, systemInfo] = await Promise.all([
    checkBackendHealth(),
    Promise.resolve({
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    }),
  ]);

  const isHealthy = backendHealth.ok;

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'omik-vsm-frontend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    backend: backendHealth,
    system: systemInfo,
  }, {
    status: isHealthy ? 200 : 503,
  });
}
