export interface Session {
  id: string;
  created_at: string;
}

export interface Persona {
  id: string;
  session_id: string;
  name: string;
  avatar_url?: string;
  provider: 'mistral' | 'nvidia' | 'openrouter';
  model_name: string;
  system_prompt: string;
  memory_md: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  is_summary: number;
  token_count: number;
  created_at?: string;
}
