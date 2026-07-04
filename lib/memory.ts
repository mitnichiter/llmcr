import { sql } from '@vercel/postgres';
import type { ChatMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

export async function checkAndCompactMemory(sessionId: string): Promise<void> {
  const { rows } = await sql`
    SELECT * FROM messages 
    WHERE session_id = ${sessionId} AND is_summary = 0 
    ORDER BY created_at ASC
  `;

  const messages = rows as unknown as ChatMessage[];
  const totalTokens = messages.reduce((acc, m) => acc + Math.ceil((m.content || '').length / 4), 0);

  if (totalTokens > 6000) {
    const serializedChat = messages.map(m => `${m.sender_name}: ${m.content}`).join('\n');
    const prompt = `Analyze this chat history log between several AI agents.
1. Produce a single concise chronological paragraph summarizing everything discussed.
2. Extract 1 key markdown bullet point of new facts learned for each participating agent.

Respond ONLY in JSON format:
{
  "summary": "concise paragraph",
  "facts": { "personaId": "- fact" }
}

Chat Log:
${serializedChat}`;

    try {
      const mRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!mRes.ok) throw new Error("Mistral compaction failed");

      const mData = await mRes.json();
      const content = mData.choices?.[0]?.message?.content || "{}";

      let summaryText = 'Summary';
      let facts: Record<string, string> = {};

      try {
        const parsed = JSON.parse(content);
        summaryText = parsed.summary || summaryText;
        facts = parsed.facts || {};
      } catch (parseErr) {}

      const summaryTokens = Math.ceil(summaryText.length / 4);
      
      await sql`DELETE FROM messages WHERE session_id = ${sessionId} AND is_summary = 0`;

      await sql`
        INSERT INTO messages (id, session_id, sender_id, sender_name, content, is_summary, token_count)
        VALUES (${uuidv4()}, ${sessionId}, 'system', 'System Summary', ${summaryText}, 1, ${summaryTokens})
      `;

      for (const [personaId, fact] of Object.entries(facts)) {
        await sql`
          UPDATE personas 
          SET memory_md = CASE WHEN memory_md = '' OR memory_md IS NULL THEN ${fact} ELSE memory_md || '\n' || ${fact} END
          WHERE id = ${personaId}
        `;
      }
    } catch (e) {}
  }
}
