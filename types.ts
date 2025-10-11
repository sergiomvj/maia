import { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

export type User = SupabaseUser;
export type Session = SupabaseSession;

export type ActiveView = 'chat' | 'agenda' | 'shoppingList' | 'profile';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  encrypted_api_key?: string;
  llm_provider?: 'gemini' | 'openai' | 'anthropic';
}

export interface Reminder {
  id: string; // uuid
  user_id: string;
  task: string;
  due_date?: string;
  due_time?: string;
  is_completed: boolean;
  priority: 'High' | 'Medium' | 'Low';
  created_at: string;
}

export interface Note {
  id: string; // uuid
  user_id: string;
  content: string;
  created_at: string;
}

export interface ShoppingListItem {
  id: string; // uuid
  user_id: string;
  item: string;
  quantity: number;
  is_collected: boolean;
  created_at: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
}

export interface ChatHistoryEntry {
  id: string;
  user_id: string;
  speaker: 'user' | 'maia' | 'system';
  text: string;
  created_at: string;
}


export interface TranscriptEntry {
  speaker: 'user' | 'maia' | 'system';
  text: string;
  isFinal: boolean;
  id?: string; // Corresponds to ChatHistoryEntry id
  citations?: { web: { uri: string; title: string } }[];
  imageData?: string; // Base64 encoded image data
}

export type LegalPageType = 'about' | 'privacy' | 'terms' | 'manual';

// Types for WebSocket communication with the proxy
export type ClientToServerMessage =
  | { type: 'audio'; payload: { data: string; mimeType: string } }
  | { type: 'toolResponse'; payload: any };

export type ServerToClientMessage =
  | { type: 'error'; payload: string }
  | { type: 'toolCall'; payload: any }
  | { type: 'transcription'; payload: { speaker: 'user' | 'maia'; text: string; isFinal: boolean; kind: 'input' | 'output' } }
  | { type: 'audio'; payload: { data: string } }
  | { type: 'connectionReady' };