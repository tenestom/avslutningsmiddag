import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TEST_PARTICIPANTS, type TestParticipant } from '@/test-data/fixtures';
import { getAllParticipantsWithAnswers, setPersona, setSpeech } from '@shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateTextRequest {
  useTestData: boolean;
  toneInstructions?: string;
}

interface GenerateTextResponse {
  personaName: string;
  personaDescription: string;
  portraitPrompt: string;
  speechScript: string;
}

interface ParticipantWithAnswers {
  name: string;
  answers: Array<{
    question_number: number;
    question_text: string;
    answer_text: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format all participants' answers into a readable text block for the LLM prompt.
 */
function formatAnswers(participants: ParticipantWithAnswers[]): string {
  return participants
    .map((p, i) => {
      const answerLines = p.answers
        .sort((a, b) => a.question_number - b.question_number)
        .map((a) => `  Fråga ${a.question_number}: ${a.answer_text}`)
        .join('\n');
      return `Deltagare ${i + 1} (${p.name}):\n${answerLines}`;
    })
    .join('\n\n');
}

/**
 * Build the prompt for Gemini.
 */
function buildPrompt(allAnswersFormatted: string, toneInstructions: string): string {
  return `You are synthesizing a fictional AI persona from survey answers submitted by 15-20+ participants who just completed a Swedish "totalförsvar" (total defense/civil preparedness) course. You will receive all their answers to 5 questions, plus an optional tone/style directive from the event organizer.

QUESTIONS ANSWERED BY PARTICIPANTS:
1. Roligaste/minnesvärda från kursen (för humor/öppning)
2. Det största hotet mot vår säkerhet (hotbild)
3. En sak Sverige ska satsa på för totalförsvaret (strategi)
4. Viktigast att göra imorgon (prioritering)
5. Tack till kursen/arrangören (personligt/avslutning)

YOUR TASK:
1. Read all answers and identify recurring themes, common humor, and the overall "voice" of the group.
2. Invent a fictional persona — a name and a short personality description — that feels like a natural synthesis of the group's tone (e.g. dry-humored analyst, no-nonsense veteran, enthusiastic optimist — let the actual answers decide, don't default to generic).
3. Write a short physical/visual description of the persona suitable for generating a portrait image (age range, style, vibe — not a real person, clearly fictional/illustrated character).
4. Write a speech script in the style of an American graduation/commencement speech, delivered by this persona, MAX 650 words (~5 minutes spoken). Structure it in exactly these 5 parts, flowing naturally between them (no visible headers in the final script):
   - Opening: warm, personal greeting + thank-you to the organizer, with some humor — draw on the funniest/most memorable answers from Q1
   - Hotbild: describe the group's perceived biggest threat, with dry humor rather than fear — synthesize the recurring themes from Q2
   - Strategi: the big-picture direction Sweden should invest in — synthesize Q3, delivered with graduation-speech-style conviction ("the path forward...")
   - Prioritering: top 3 concrete things to do first, synthesized from Q4 — can reference something specific and fun from an answer (paraphrased, never attributed to a specific name)
   - Closing: ties the thank-you and the "program declaration" together in an inspiring closing line / signature phrase

IMPORTANT CONSTRAINTS:
- Never mention any participant by name or attribute a quote to a specific person — synthesize and paraphrase, this is about the group as a whole
- Keep it genuinely funny AND thought-provoking — avoid generic corporate/political speech clichés
- If a tone/style directive is provided below, prioritize it over the defaults above
- Write in Swedish

TONE/STYLE DIRECTIVE (optional, from organizer): ${toneInstructions}

OUTPUT FORMAT: respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "personaName": "...",
  "personaDescription": "...",
  "portraitPrompt": "...",
  "speechScript": "..."
}

PARTICIPANT ANSWERS:
${allAnswersFormatted}`;
}

/**
 * Strip markdown code fences if the model includes them despite instructions.
 */
function stripMarkdownFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse request body
    let body: GenerateTextRequest;
    try {
      body = (await req.json()) as GenerateTextRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { useTestData, toneInstructions = '' } = body;

    // 2. Validate Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    // 3. Gather participant data
    let participants: ParticipantWithAnswers[];

    if (useTestData) {
      // Use fixtures from test-data/fixtures.ts
      participants = TEST_PARTICIPANTS.map((p: TestParticipant) => ({
        name: p.name,
        answers: p.answers,
      }));
    } else {
      // Fetch real data from Vercel KV via participants:ids list
      const allWithAnswers = await getAllParticipantsWithAnswers();

      if (allWithAnswers.length === 0) {
        return NextResponse.json(
          {
            error:
              'Inga riktiga deltagarsvar hittades i KV. Kontrollera att deltagare har skickat in svar via deltagarformuläret.',
          },
          { status: 400 }
        );
      }

      participants = allWithAnswers.map(({ participant, answers }) => ({
        name: participant.name,
        answers,
      }));
    }

    if (participants.length === 0) {
      return NextResponse.json(
        { error: 'Inga deltagarsvar att generera från.' },
        { status: 400 }
      );
    }

    // 4. Format the answers into text
    const allAnswersFormatted = formatAnswers(participants);
    const prompt = buildPrompt(allAnswersFormatted, toneInstructions.trim());

    // 5. Call Gemini API
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

    let rawText: string;
    try {
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
    } catch (genError: unknown) {
      console.error('Gemini API error:', genError);
      const message =
        genError instanceof Error ? genError.message : 'Unknown Gemini API error';
      return NextResponse.json(
        { error: `Gemini API-anrop misslyckades: ${message}` },
        { status: 502 }
      );
    }

    // 6. Parse the JSON response
    const cleaned = stripMarkdownFences(rawText);
    let parsed: GenerateTextResponse;
    try {
      parsed = JSON.parse(cleaned) as GenerateTextResponse;
    } catch {
      console.error('Failed to parse Gemini JSON response:', cleaned);
      return NextResponse.json(
        {
          error:
            'Modellen returnerade ett svar som inte kunde tolkas som JSON. Försök igen.',
          rawResponse: cleaned.slice(0, 500), // For debugging, trim to 500 chars
        },
        { status: 502 }
      );
    }

    // 7. Validate expected fields
    const { personaName, personaDescription, portraitPrompt, speechScript } = parsed;
    if (!personaName || !personaDescription || !portraitPrompt || !speechScript) {
      return NextResponse.json(
        {
          error: 'Modellens JSON-svar saknade förväntade fält (personaName, personaDescription, portraitPrompt, speechScript).',
          rawResponse: cleaned.slice(0, 500),
        },
        { status: 502 }
      );
    }

    // 8. If using real data, persist the result to KV
    if (!useTestData) {
      try {
        await setPersona({
          name: personaName,
          description: personaDescription,
          portrait_url: '',
        });
        await setSpeech({
          script: speechScript,
          video_url: null,
          status: 'draft',
        });
      } catch (persistError: unknown) {
        // Log but don't fail the request — the client still gets the result
        console.error('Failed to persist persona/speech to KV:', persistError);
      }
    }

    // 9. Return success
    return NextResponse.json({ personaName, personaDescription, portraitPrompt, speechScript });
  } catch (error: unknown) {
    console.error('Unexpected error in /api/generate-text:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json(
      { error: `Internt serverfel: ${message}` },
      { status: 500 }
    );
  }
}
