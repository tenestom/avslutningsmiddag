'use server';

import { setParticipant, addAnswer, addParticipantId } from '@shared';

export interface AnswerInput {
  question_number: number;
  question_text: string;
  answer_text: string;
}

export interface SubmitAnswersInput {
  name?: string;
  answers: AnswerInput[];
}

export interface SubmitAnswersResult {
  success: boolean;
  participantId?: string;
  error?: string;
}

export async function submitParticipantAnswers(
  input: SubmitAnswersInput
): Promise<SubmitAnswersResult> {
  try {
    if (!input.answers || input.answers.length !== 5) {
      return { success: false, error: 'Alla 5 frågor måste besvaras.' };
    }

    for (const ans of input.answers) {
      if (!ans.answer_text || ans.answer_text.trim().length < 15) {
        return {
          success: false,
          error: `Svaret på fråga ${ans.question_number} måste vara minst 15 tecken.`,
        };
      }
    }

    const participantId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // 1. Save participant to KV (anonymous)
    await setParticipant(participantId, {
      id: participantId,
      created_at: createdAt,
    });


    // 2. Register participant ID in the global list (used for bulk fetching)
    await addParticipantId(participantId);

    // 3. Add each answer to KV
    for (const ans of input.answers) {
      await addAnswer(participantId, {
        question_number: ans.question_number,
        question_text: ans.question_text,
        answer_text: ans.answer_text.trim(),
      });
    }

    return {
      success: true,
      participantId,
    };

  } catch (error: unknown) {
    console.error('Error saving participant answers to KV:', error);
    return {
      success: false,
      error: 'Ett oväntat fel uppstod när dina svar skulle sparas. Kontrollera anslutningen och försök igen.',
    };
  }
}
