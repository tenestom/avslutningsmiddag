import { kv } from '@vercel/kv';
import type {
  Participant,
  Answer,
  Persona,
  Speech,
  QAEntry,
  ChatMessage,
} from './types';

export { kv };

/**
 * Participant helpers
 * Key: participant:{id}
 */
export async function getParticipant(id: string): Promise<Participant | null> {
  return await kv.get<Participant>(`participant:${id}`);
}

export async function setParticipant(id: string, data: Participant) {
  return await kv.set(`participant:${id}`, data);
}

/**
 * Answers helpers
 * Key: answers:{participantId}
 */
export async function getAnswers(participantId: string): Promise<Answer[]> {
  try {
    const list = await kv.lrange<Answer>(`answers:${participantId}`, 0, -1);
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  } catch {
    // Fallback if key was set as JSON object
  }
  const direct = await kv.get<Answer[]>(`answers:${participantId}`);
  return direct ?? [];
}

export async function addAnswer(participantId: string, answer: Answer): Promise<number> {
  return await kv.rpush(`answers:${participantId}`, answer);
}

/**
 * Persona helpers
 * Key: persona
 */
export async function getPersona(): Promise<Persona | null> {
  return await kv.get<Persona>('persona');
}

export async function setPersona(data: Persona) {
  return await kv.set('persona', data);
}

/**
 * Speech helpers
 * Key: speech
 */
export async function getSpeech(): Promise<Speech | null> {
  return await kv.get<Speech>('speech');
}

export async function setSpeech(data: Speech) {
  return await kv.set('speech', data);
}

/**
 * QA Log helpers
 * Keys: qa_log:ids (list), qa_log:{id} (entry)
 */
export async function getQAIds(): Promise<string[]> {
  const ids = await kv.lrange<string>('qa_log:ids', 0, -1);
  return ids ?? [];
}

export async function addQAEntry(entry: QAEntry): Promise<void> {
  await kv.set(`qa_log:${entry.id}`, entry);
  await kv.rpush('qa_log:ids', entry.id);
}

export async function getQAEntry(id: string): Promise<QAEntry | null> {
  return await kv.get<QAEntry>(`qa_log:${id}`);
}

export async function updateQAEntry(id: string, updates: Partial<QAEntry>): Promise<QAEntry | null> {
  const existing = await getQAEntry(id);
  if (!existing) {
    return null;
  }
  const updated: QAEntry = { ...existing, ...updates };
  await kv.set(`qa_log:${id}`, updated);
  return updated;
}

/**
 * Chat helpers
 * Key: chat:{participantId}
 */
export async function getChatMessages(participantId: string): Promise<ChatMessage[]> {
  try {
    const list = await kv.lrange<ChatMessage>(`chat:${participantId}`, 0, -1);
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  } catch {
    // Fallback if key was set as JSON object
  }
  const direct = await kv.get<ChatMessage[]>(`chat:${participantId}`);
  return direct ?? [];
}

export async function addChatMessage(participantId: string, message: ChatMessage): Promise<number> {
  return await kv.rpush(`chat:${participantId}`, message);
}
