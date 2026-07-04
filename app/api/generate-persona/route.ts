import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    const prompt = `You are an expert character and system prompt designer. 
The user wants an AI agent based on the following idea: "${idea}"

Generate a JSON object for this persona. Follow exactly this structure:
{
  "name": "A suitable name for the agent",
  "system_prompt": "A detailed system prompt outlining their personality, tone, and behavior."
}

Only return the raw JSON object. Do not include markdown blocks or any other text.`;

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      throw new Error(`Mistral API Error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty response from Mistral");

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
