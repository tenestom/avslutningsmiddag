import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// WAV header builder (same as generate-audio-snippet)
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
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
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

// ---------------------------------------------------------------------------
// Split text into chunks at sentence boundaries.
// Gemini TTS has a practical limit of ~3000-4000 tokens per request.
// We split conservatively at ~1500 characters (≈ ~75–100 seconds of speech each).
// ---------------------------------------------------------------------------
const CHUNK_CHAR_LIMIT = 1500;

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_CHAR_LIMIT) return [text];

  const chunks: string[] = [];
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) ?? [text];

  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_CHAR_LIMIT && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

// ---------------------------------------------------------------------------
// Call Gemini TTS for a single chunk, return raw PCM buffer + sample rate
// ---------------------------------------------------------------------------
async function generateChunkPcm(
  model: ReturnType<ReturnType<typeof GoogleGenerativeAI.prototype.getGenerativeModel>['generateContent']>,
  geminiModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  chunkText: string,
  voiceName: string
): Promise<{ pcmBuffer: Buffer; sampleRate: number }> {
  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: chunkText }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    } as unknown as Parameters<typeof geminiModel.generateContent>[0] extends { generationConfig?: infer C } ? C : never,
  });

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find(
    (p) => (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData?.mimeType?.startsWith('audio/')
  ) as { inlineData?: { mimeType?: string; data?: string } } | undefined;

  if (!audioPart?.inlineData?.data) {
    throw new Error('Gemini TTS returnerade inget ljud för detta textblock.');
  }

  const mimeType = audioPart.inlineData.mimeType ?? '';
  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

  return { pcmBuffer, sampleRate };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: { text: string; voiceName?: string };
    try {
      body = (await req.json()) as { text: string; voiceName?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { text, voiceName = 'Kore' } = body;
    if (!text?.trim()) {
      return NextResponse.json({ error: 'text saknas i anropet.' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY är inte konfigurerad på servern.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-tts-preview' });

    // Split into chunks and generate each sequentially (avoid parallel API calls hitting rate limits)
    const chunks = splitIntoChunks(text.trim());
    const pcmBuffers: Buffer[] = [];
    let finalSampleRate = 24000;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const { pcmBuffer, sampleRate } = await generateChunkPcm(null as never, model, chunks[i], voiceName);
        pcmBuffers.push(pcmBuffer);
        finalSampleRate = sampleRate; // All chunks will have the same rate
      } catch (chunkError: unknown) {
        const msg = chunkError instanceof Error ? chunkError.message : 'Okänt fel';
        return NextResponse.json(
          { error: `Röstsyntes misslyckades för block ${i + 1}/${chunks.length}: ${msg}` },
          { status: 502 }
        );
      }
    }

    // Concatenate all PCM buffers
    const concatenatedPcm = Buffer.concat(pcmBuffers);

    // Calculate duration: samples = bytes / bytesPerSample, duration = samples / sampleRate
    const bytesPerSample = 2; // 16-bit = 2 bytes
    const totalSamples = concatenatedPcm.length / bytesPerSample;
    const durationSeconds = Math.round(totalSamples / finalSampleRate);

    // Wrap in WAV header
    const wavBuffer = pcmToWav(concatenatedPcm, finalSampleRate);
    const audioUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`;

    return NextResponse.json({ audioUrl, durationSeconds });
  } catch (error: unknown) {
    console.error('Unexpected error in /api/generate-full-audio:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
