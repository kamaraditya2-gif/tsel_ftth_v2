import { NextRequest, NextResponse } from 'next/server';
import { buildEdgeConfigResponse, verifyEdgeRequest } from '@/lib/edge-sync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    verifyEdgeRequest(req);
    return NextResponse.json(buildEdgeConfigResponse(), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyEdgeRequest(req);
    const payload = await req.json().catch(() => ({}));

    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid config payload');
    }

    const config = buildEdgeConfigResponse();
    const merged = { ...config, ...payload };

    return NextResponse.json({
      accepted: true,
      config: merged,
      receivedAt: new Date().toISOString(),
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 400 });
  }
}
