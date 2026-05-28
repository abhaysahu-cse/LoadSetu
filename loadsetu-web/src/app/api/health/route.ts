// ============================================================================
// Health Check Endpoint for Docker Health Checks
// ============================================================================

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'loadsetu-web',
    },
    { status: 200 }
  );
}
