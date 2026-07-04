import type { Persona, ChatMessage } from './types';

export async function generateResponse(persona: Persona, chatHistory: ChatMessage[], mode: 'human' | 'ai'): Promise<ReadableStream> {
  const rawMessages = chatHistory.map(m => {
    let cleanContent = m.content;
    while (cleanContent.toLowerCase().startsWith(m.sender_name.toLowerCase() + ":")) {
      cleanContent = cleanContent.substring(m.sender_name.length + 1).trim();
    }
    const isAssistant = m.sender_id === persona.id;
    return {
      role: isAssistant ? 'assistant' : 'user',
      content: isAssistant ? (cleanContent || "...") : `${m.sender_name}: ${cleanContent || "..."}`
    };
  });

  const messages: { role: string; content: string }[] = [];
  for (const msg of rawMessages) {
    if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
      messages[messages.length - 1].content += `\n\n${msg.content}`;
    } else {
      messages.push({ ...msg });
    }
  }

  // Mistral and OpenAI APIs STRICTLY require the final message to be from the 'user'.
  if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
    messages.push({ role: 'user', content: 'Continue the conversation naturally.' });
  }

  const instruction = mode === 'human'
    ? `CRITICAL INSTRUCTION: You are in a casual real-time group chat. Talk naturally and informally. Keep your replies extremely SHORT and punchy—strictly 1 to 2 sentences maximum. Do not write your name at the start of your message, and do not use lists, bullet points, or formal structure. Speak directly in character.`
    : `CRITICAL INSTRUCTION: You are in an open discussion. Talk extensively and in-depth, matching your persona config perfectly. You are highly encouraged to write multiple detailed paragraphs, elaborate rants, and passionate arguments when appropriate. Do not write your name at the start of your message, and speak directly in character.`;

  messages.unshift({
    role: 'system',
    content: `${persona.system_prompt}\n\nMemories:\n${persona.memory_md || ''}\n\n${instruction}`
  });

  // Dynamic Multi-Provider Routing & Auto-Correction Fallback
  let provider = persona.provider || 'mistral';
  let model = persona.model_name || 'mistral-medium-latest';

  // If the model contains a slash (e.g. "nvidia/...", "mistralai/...") but provider is 'mistral',
  // we auto-correct the provider to openrouter (or nvidia) because Mistral's native API has no slashes.
  if (provider === 'mistral' && model.includes('/')) {
    if (model.startsWith('meta/') || model.startsWith('nvidia/')) {
      provider = 'nvidia';
    } else {
      provider = 'openrouter';
    }
  }

  // Auto-correct/fallback models for NVIDIA NIM API tier accessibility (e.g., 340B model returns 404 on free tier)
  if (provider === 'nvidia') {
    if (model === 'nvidia/nemotron-4-340b-instruct') {
      model = 'meta/llama-3.1-70b-instruct';
    }
  }

  let url = 'https://api.mistral.ai/v1/chat/completions';
  let token = process.env.MISTRAL_API_KEY;

  if (provider === 'nvidia') {
    url = 'https://integrate.api.nvidia.com/v1/chat/completions';
    token = process.env.NVIDIA_API_KEY;
  } else if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    token = process.env.OPENROUTER_API_KEY;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${provider.toUpperCase()} API Error: ${res.status} ${errText}`);
  }
  
  if (!res.body) {
    throw new Error(`${provider.toUpperCase()} Response body is null`);
  }
  
  return res.body;
}
