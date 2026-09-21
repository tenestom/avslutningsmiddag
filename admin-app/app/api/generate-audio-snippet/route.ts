import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// WAV header builder for raw PCM data returned by Gemini TTS.
// Gemini TTS outputs 16-bit PCM, 24000 Hz, mono by default.
// ---------------------------------------------------------------------------
function pcmToWav(pcmData: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);

  return buffer;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse request body
    let body: { text: string; voiceName?: string; styleInstructions?: string };
    try {
      body = (await req.json()) as { text: string; voiceName?: string; styleInstructions?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { text, voiceName = 'Kore', styleInstructions } = body;
    if (!text?.trim()) {
      return NextResponse.json({ error: 'text saknas i anropet.' }, { status: 400 });
    }

    // 2. Validate API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY är inte konfigurerad på servern.' },
        { status: 500 }
      );
    }

    // 3. Call Gemini TTS
    // styleInstructions is passed as systemInstruction — the documented way to influence
    // delivery style/dialect without the instruction being spoken aloud as literal text.
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const modelOptions: Parameters<typeof genAI.getGenerativeModel>[0] = {
      model: 'gemini-3.1-flash-tts-preview',
      ...(styleInstructions?.trim()
        ? { systemInstruction: styleInstructions.trim() }
        : {}),
    };
    const model = genAI.getGenerativeModel(modelOptions);

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        } as unknown as Parameters<typeof model.generateContent>[0] extends { generationConfig?: infer C } ? C : never,
      });
    } catch (genError: unknown) {
      console.error('Gemini TTS error:', genError);
      const message = genError instanceof Error ? genError.message : 'Okänt Gemini-fel';
      return NextResponse.json(
        { error: `Röstsyntes misslyckades: ${message}` },
        { status: 502 }
      );
    }

    // 4. Extract audio part
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find(
      (p) => (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData?.mimeType?.startsWith('audio/')
    ) as { inlineData?: { mimeType?: string; data?: string } } | undefined;

    if (!audioPart?.inlineData?.data) {
      return NextResponse.json(
        { error: 'Modellen returnerade inget ljud. Försök igen.' },
        { status: 502 }
      );
    }

    // 5. Decode the base64 PCM bytes from the Gemini response into a raw Buffer,
    //    then wrap with a correct WAV header so browsers can play it natively.
    //    Gemini TTS always returns raw 16-bit PCM at 24000 Hz mono — never pre-wrapped WAV.
    const rawBase64 = audioPart.inlineData.data;
    const mimeType = audioPart.inlineData.mimeType ?? '';

    // Parse sample rate from mimeType if explicitly provided (e.g. "audio/L16;rate=24000")
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    // Decode base64 → raw binary PCM bytes, then build a valid WAV
    const rawPcmBuffer = Buffer.from(rawBase64, 'base64');
    const wavBuffer = pcmToWav(rawPcmBuffer, sampleRate);
    const audioUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`;

    return NextResponse.json({ audioUrl });
  } catch (error: unknown) {
    console.error('Unexpected error in /api/generate-audio-snippet:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
