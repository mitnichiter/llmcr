import { sql } from '@vercel/postgres';
import { runTurnTakingEvaluation } from '@/lib/orchestrator';
import { generateResponse } from '@/lib/generation';
import { checkAndCompactMemory } from '@/lib/memory';
import type { Persona, ChatMessage } from '@/lib/types';

export const runtime = 'edge';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await context.params;
    const { message, isIcebreaker, mode } = await req.json();
    const chatMode = mode === 'ai' ? 'ai' : 'human';
    
    if (!isIcebreaker && message && message.trim().length > 0) {
      const userMsgId = crypto.randomUUID();
      const userMsgTokens = Math.ceil((message || '').length / 4);
      await sql`
        INSERT INTO messages (id, session_id, sender_id, sender_name, content, is_summary, token_count)
        VALUES (${userMsgId}, ${sessionId}, 'user', 'User', ${message}, 0, ${userMsgTokens})
      `;
    }

    const personasRes = await sql`SELECT * FROM personas WHERE session_id = ${sessionId}`;
    const personas = personasRes.rows as unknown as Persona[];

    const historyRes = await sql`
      SELECT * FROM messages 
      WHERE session_id = ${sessionId} 
      ORDER BY created_at ASC
    `;
    const chatHistory = historyRes.rows as unknown as ChatMessage[];

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode('event: status\ndata: evaluating\n\n'));

        let winningPersonaId: string | null = null;
        let winner: Persona | undefined;

        if (isIcebreaker && personas.length > 0) {
          // Randomly pick an agent
          winner = personas[Math.floor(Math.random() * personas.length)];
          winningPersonaId = winner.id;
          
          // Inject a temporary system message to jumpstart the scene naturally
          chatHistory.push({
            id: 'temp-icebreaker',
            session_id: sessionId,
            sender_id: 'system',
            sender_name: 'System',
            content: `SYSTEM INSTRUCTION: You have been randomly selected to kick off the conversation. Dive right into character and start talking in a way that perfectly fits your persona and the current scenario. Do not formally introduce yourself unless it makes sense for your role.`,
            is_summary: 0,
            token_count: 0
          });
        } else {
          winningPersonaId = await runTurnTakingEvaluation(personas, message || '', chatHistory);
          winner = personas.find(p => p.id === winningPersonaId);
        }

        if (!winner) {
          controller.enqueue(encoder.encode('event: status\ndata: idle\n\n'));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode('event: status\ndata: typing\n\n'));
        controller.enqueue(encoder.encode(`event: agent\ndata: ${JSON.stringify({ id: winner.id, name: winner.name })}\n\n`));

        try {
          const genStream = await generateResponse(winner, chatHistory, chatMode);
          const reader = genStream.getReader();
          const decoder = new TextDecoder();
          let fullResponse = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
               if (line.startsWith('data:') && !line.includes('[DONE]')) {
                  try {
                    const dataStr = line.slice(5).trim();
                    if (dataStr === '[DONE]') continue;
                    const data = JSON.parse(dataStr);
                    let token = '';
                    if (data.choices && data.choices[0].delta?.content) {
                      token = data.choices[0].delta.content;
                    }
                    if (data.response) {
                      token = data.response;
                    }
                    if (token) {
                      fullResponse += token;
                      controller.enqueue(encoder.encode(`event: stream\ndata: ${JSON.stringify({ chunk: token })}\n\n`));
                    }
                  } catch (e) {
                    // ignore
                  }
               }
            }
          }

          let finalResponse = fullResponse.trim();
          while (finalResponse.toLowerCase().startsWith(winner.name.toLowerCase() + ":")) {
            finalResponse = finalResponse.substring(winner.name.length + 1).trim();
          }

          const agentMsgId = crypto.randomUUID();
          const agentMsgTokens = Math.ceil(finalResponse.length / 4);
          
          await sql`
            INSERT INTO messages (id, session_id, sender_id, sender_name, content, is_summary, token_count)
            VALUES (${agentMsgId}, ${sessionId}, ${winner.id}, ${winner.name}, ${finalResponse}, 0, ${agentMsgTokens})
          `;

          await checkAndCompactMemory(sessionId);
        } catch (genErr) {
          const errStr = String(genErr);
          controller.enqueue(encoder.encode(`event: stream\ndata: {"chunk": "\\n\\n[SYSTEM ERROR: ${errStr.replace(/"/g, '\\"')}]"}\n\n`));
          controller.enqueue(encoder.encode(`event: status\ndata: error\n\n`));
        }
        controller.enqueue(encoder.encode('event: status\ndata: idle\n\n'));
        controller.close();
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
