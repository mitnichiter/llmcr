import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export const GLOBAL_SESSION_ID = '11111111-1111-1111-1111-111111111111';

export async function GET() {
  try {
    await sql`
      INSERT INTO sessions (id) 
      VALUES (${GLOBAL_SESSION_ID}) 
      ON CONFLICT (id) DO NOTHING
    `;

    const personasRes = await sql`
      SELECT * FROM personas WHERE session_id = ${GLOBAL_SESSION_ID}
    `;

    const messagesRes = await sql`
      SELECT * FROM messages WHERE session_id = ${GLOBAL_SESSION_ID} ORDER BY created_at ASC
    `;

    return NextResponse.json({
      sessionId: GLOBAL_SESSION_ID,
      personas: personasRes.rows,
      messages: messagesRes.rows
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
