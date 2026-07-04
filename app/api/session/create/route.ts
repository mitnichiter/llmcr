import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';

export async function POST() {
  const sessionId = uuidv4();
  try {
    await sql`INSERT INTO sessions (id) VALUES (${sessionId})`;
    return NextResponse.json({ sessionId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
