import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    const body = await req.json();
    const personas = Array.isArray(body) ? body : [body];

    for (const p of personas) {
      await sql`
        INSERT INTO personas (id, session_id, name, avatar_url, provider, model_name, system_prompt, memory_md)
        VALUES (${p.id}, ${sessionId}, ${p.name}, ${p.avatar_url || ''}, ${p.provider}, ${p.model_name}, ${p.system_prompt}, ${p.memory_md || ''})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          provider = EXCLUDED.provider,
          model_name = EXCLUDED.model_name,
          system_prompt = EXCLUDED.system_prompt,
          memory_md = EXCLUDED.memory_md
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    const { searchParams } = new URL(req.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json({ error: "Missing personaId" }, { status: 400 });
    }

    await sql`
      DELETE FROM personas 
      WHERE id = ${personaId} AND session_id = ${sessionId}
    `;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
