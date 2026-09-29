import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Docker / Caddy healthcheck */
export function GET() {
  return NextResponse.json({ ok: true, service: 'dracord-web' });
}
