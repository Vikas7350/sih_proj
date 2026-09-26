import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Contact form submission endpoint (pages.md §5.3).
 * ponytail: writes submissions to a JSON file under .data/ — no email service
 * or DB configured yet. Ceiling: this is a local file, not durable/email.
 * Upgrade: swap writeFile for an email service (nodemailer is already a dep)
 * or a DB insert once a real destination is decided.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.email || !body.message) {
      return NextResponse.json({ error: 'name, email, and message are required' }, { status: 400 });
    }

    const dir = path.join(process.cwd(), '.data');
    await mkdir(dir, { recursive: true });
    const record = { ...body, id: randomUUID(), receivedAt: new Date().toISOString() };
    await writeFile(
      path.join(dir, `contact-${Date.now()}.json`),
      JSON.stringify(record, null, 2)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/contact error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
