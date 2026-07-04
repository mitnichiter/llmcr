import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface OpenRouterModel {
  id: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  try {
    if (provider === 'mistral') {
      const res = await fetch('https://api.mistral.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` }
      });
      if (!res.ok) throw new Error(`Mistral Error: ${res.status}`);
      const data = await res.json() as { data: { id: string }[] };
      const models = data.data?.map(m => m.id) || [];
      return NextResponse.json({ models });
    } else if (provider === 'nvidia') {
      const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}` }
      });
      if (!res.ok) throw new Error(`NVIDIA Error: ${res.status}`);
      const data = await res.json() as { data: { id: string }[] };
      const models = data.data?.map(m => m.id) || [];
      return NextResponse.json({ models });
    } else if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error(`OpenRouter Error: ${res.status}`);
      const data = await res.json() as { data: OpenRouterModel[] };
      const freeModels = data.data?.filter(m => {
        // pricing can be float like "0.0" or "0"
        const pPrice = Number(m.pricing?.prompt) || 0;
        const cPrice = Number(m.pricing?.completion) || 0;
        return pPrice === 0 && cPrice === 0;
      }).map(m => m.id) || [];
      return NextResponse.json({ models: freeModels });
    }
    
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
