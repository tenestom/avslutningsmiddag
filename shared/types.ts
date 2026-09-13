export type SpeechStatus = 'draft' | 'generating' | 'ready';

export type QAStatus = 'pending' | 'approved' | 'played';

export interface Participant {
  id: string;
  name: string;
  created_at: string;
}

export interface Answer {
  question_number: number;
  question_text: string;
  answer_text: string;
}

export interface Persona {
  name: string;
  description: string;
  portrait_url: string;
}

export interface Speech {
  script: string;
  video_url: string | null;
  status: SpeechStatus;
}

export interface QAEntry {
  id: string;
  question: string;
  answer: string | null;
  video_url: string | null;
  status: QAStatus;
  created_at: string;
}

export interface ChatMessage {
  message: string;
  response: string | null;
  created_at: string;
}
