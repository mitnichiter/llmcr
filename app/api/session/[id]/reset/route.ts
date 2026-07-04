import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    await sql`DELETE FROM messages WHERE session_id = ${sessionId}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
