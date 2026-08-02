import { NextRequest, NextResponse } from 'next/server';

import { study2RuntimeRepository } from '@/lib/study2-runtime-postgres';
import {
  handleStudy2RuntimeGet,
  handleStudy2RuntimePost,
  parseStudy2RuntimeRequestBody,
  STUDY2_RUNTIME_MAX_BODY_BYTES,
  type Study2RuntimeHttpResult,
} from '@/src/study2/runtime-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function respond(result: Study2RuntimeHttpResult): NextResponse {
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

const ROUTE_FAILURE: Study2RuntimeHttpResult = {
  status: 500,
  headers: {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  },
  body: { error: 'runtime_integrity_failure' },
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return respond(await handleStudy2RuntimeGet({
      repository: study2RuntimeRepository(),
      authorization: request.headers.get('authorization'),
    }));
  } catch {
    return respond(ROUTE_FAILURE);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawContentLength = request.headers.get('content-length');
  if (rawContentLength !== null && Number(rawContentLength) > STUDY2_RUNTIME_MAX_BODY_BYTES) {
    return respond({ status: 413, headers: ROUTE_FAILURE.headers, body: { error: 'request_too_large' } });
  }
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return respond({ status: 400, headers: ROUTE_FAILURE.headers, body: { error: 'invalid_json' } });
  }
  const parsed = parseStudy2RuntimeRequestBody(rawBody);
  if (!parsed.ok) return respond(parsed.response);
  try {
    return respond(await handleStudy2RuntimePost({
      repository: study2RuntimeRepository(),
      authorization: request.headers.get('authorization'),
      contentLength: rawContentLength,
      body: parsed.body,
    }));
  } catch {
    return respond(ROUTE_FAILURE);
  }
}
