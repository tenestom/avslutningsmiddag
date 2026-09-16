import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// WAV header builder for raw PCM data returned by Gemini TTS
// ---------------------------------------------------------------------------
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const header = Buffer.alloc(headerSize);

  // RIFF descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);   // file size - 8
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);             // sub-chunk size (PCM = 16)
  header.writeUInt16LE(1, 20);              // audio format: PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // byte rate
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);               // block align
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse request body
    let body: { text: string };
    try {
      body = (await req.json()) as { text: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { text } = body;
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
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-tts-preview' });

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore', // Neutral, clear voice suitable for Swedish
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

    const rawBase64 = audioPart.inlineData.data;
    const mimeType = audioPart.inlineData.mimeType ?? 'audio/wav';

    // 5. If the response is raw PCM (L16), wrap it in a WAV container so
    //    browsers can play it natively. WAV audio is returned as-is.
    let audioUrl: string;
    if (mimeType.includes('L16') || mimeType.includes('pcm')) {
      const pcmBuffer = Buffer.from(rawBase64, 'base64');
      // Parse sample rate from mimeType if present (e.g. "audio/L16;rate=24000")
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
      audioUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
    } else {
      // Already WAV or other browser-compatible format
      audioUrl = `data:audio/wav;base64,${rawBase64}`;
    }

    return NextResponse.json({ audioUrl });
  } catch (error: unknown) {
    console.error('Unexpected error in /api/generate-audio-snippet:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
