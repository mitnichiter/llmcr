import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    const prompt = `You are an expert character and scenario designer. 
The user wants to create a group chat scenario with multiple AI agents. 
User Request: "${idea}"

Determine how many agents are needed (default to 2 or 3 if unspecified) and generate their personas.
Make sure their system prompts are highly detailed, specifying their personality, tone, quirks, and how they should interact with the others.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "personas": [
    {
      "name": "Agent Name",
      "system_prompt": "Detailed system prompt outlining personality, tone, and behavior."
    }
  ]
}`;

    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'open-mixtral-8x7b',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Mistral API Error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty response from Mistral AI");

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
