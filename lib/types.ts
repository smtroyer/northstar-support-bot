// Shared types for the client and the /api/chat route.

export type Role = 'user' | 'assistant';
export type Mode = 'bot' | 'live_agent';

/** A single turn as sent to / stored by the API (plain text only). */
export interface ApiMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  messages: ApiMessage[];
  mode: Mode;
}

export interface ChatResponse {
  reply: string;
  handoff: boolean;
}
