import type { Persona, ChatMessage } from './types';

interface EvaluationResult {
  shouldSpeak: boolean;
  interestScore: number;
}

function parseEvaluationResponse(content: string): EvaluationResult {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        shouldSpeak: Boolean(parsed?.shouldSpeak),
        interestScore: Number(parsed?.interestScore) || 0
      };
    }
  } catch (e) {}
  return { shouldSpeak: false, interestScore: 0 };
}

export async function runTurnTakingEvaluation(personas: Persona[], latestMessage: string, chatHistory: ChatMessage[]): Promise<string | null> {
  const actualLatestMessage = latestMessage.trim() ? latestMessage : (chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : "");

  // Mention bypass
  for (const persona of personas) {
    if (actualLatestMessage.toLowerCase().includes(`@${persona.name.toLowerCase()}`)) {
      return persona.id;
    }
  }

  const lastSpeaker = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].sender_id : null;
  const availableCandidates = personas.filter(p => p.id !== lastSpeaker);

  if (availableCandidates.length === 0) {
    return null;
  }

  const recentHistory = chatHistory.slice(-5).map(m => `${m.sender_name}: ${m.content}`).join("\n");
  
  const prompt = `You are an expert conversation director managing a group chat roleplay. 
Recent Conversation:
${recentHistory}

Available Candidates to Speak Next:
${availableCandidates.map(p => `ID: ${p.id}\nName: ${p.name}\nPersona: ${p.system_prompt}`).join('\n\n')}

CRITICAL INSTRUCTION: Based on the conversation flow, determine which candidate MUST speak next to keep the chat lively and natural.
- You CANNOT pick the agent who spoke last.
- If someone is directly asked a question implicitly, pick them.
- If no one clearly needs to speak, pick the most relevant candidate anyway to keep the flow going.

Respond STRICTLY in JSON format matching this schema:
{
  "winnerPersonaId": "string-id-here"
}`;

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
    
    if (!mRes.ok) {
      return null;
    }
    
    const mData = await mRes.json();
    const content = mData.choices?.[0]?.message?.content || "";
    
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.winnerPersonaId && availableCandidates.some(p => p.id === parsed.winnerPersonaId)) {
        return parsed.winnerPersonaId;
      }
    }
    
    // Fallback: pick random available
    return availableCandidates[Math.floor(Math.random() * availableCandidates.length)].id;
  } catch (e) {
    return null;
  }
}
