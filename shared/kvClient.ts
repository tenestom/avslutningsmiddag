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
 * Participant ID list helpers
 * Key: participants:ids (list of UUIDs)
 *
 * NOTE: Only participants added after addParticipantId was introduced will appear
 * in this list. Participants saved before this change were not backfilled.
 */
export async function addParticipantId(id: string): Promise<number> {
  return await kv.rpush('participants:ids', id);
}

export async function getAllParticipantIds(): Promise<string[]> {
  const ids = await kv.lrange<string>('participants:ids', 0, -1);
  return ids ?? [];
}

export async function getAllParticipantsWithAnswers(): Promise<
  Array<{ participant: Participant; answers: Answer[] }>
> {
  const ids = await getAllParticipantIds();
  const results = await Promise.all(
    ids.map(async (id) => {
      const participant = await getParticipant(id);
      if (!participant) return null;
      const answers = await getAnswers(id);
      return { participant, answers };
    })
  );
  // Filter out any nulls (participant key deleted after ID was added to list)
  return results.filter(
    (r): r is { participant: Participant; answers: Answer[] } => r !== null
  );
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

/**
 * Reset all event data — for use before the real event / during testing.
 * Deletes all participant, answer, chat, qa_log, persona, and speech keys.
 * Returns a summary of how many records were deleted.
 */
export async function resetAllData(): Promise<{
  participantsDeleted: number;
  qaEntriesDeleted: number;
}> {
  // 1. Delete per-participant data
  const participantIds = await getAllParticipantIds();
  await Promise.all(
    participantIds.flatMap((id) => [
      kv.del(`participant:${id}`),
      kv.del(`answers:${id}`),
      kv.del(`chat:${id}`),
    ])
  );
  await kv.del('participants:ids');

  // 2. Delete QA log entries
  const qaIds = await getQAIds();
  await Promise.all(qaIds.map((id) => kv.del(`qa_log:${id}`)));
  await kv.del('qa_log:ids');

  // 3. Delete persona and speech
  await kv.del('persona');
  await kv.del('speech');

  return {
    participantsDeleted: participantIds.length,
    qaEntriesDeleted: qaIds.length,
  };
}
