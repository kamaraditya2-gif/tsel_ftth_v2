import { NextRequest, NextResponse } from 'next/server';
import { ingestEdgeTargets, parseEdgePayload, resolveNodeId, verifyEdgeRequest } from '@/lib/edge-sync';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    verifyEdgeRequest(req);
    const payload = await parseEdgePayload(req);
    const nodeId = resolveNodeId(req, payload);
    const result = await ingestEdgeTargets(nodeId, payload);

    return NextResponse.json({
      accepted: true,
      nodeId,
      inserted: result.inserted,
      receivedAt: new Date().toISOString(),
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthorized' ? 401 : 400 }
    );
  }
}
