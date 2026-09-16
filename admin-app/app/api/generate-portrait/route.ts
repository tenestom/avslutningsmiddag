import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse request body
    let body: { portraitPrompt: string };
    try {
      body = (await req.json()) as { portraitPrompt: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { portraitPrompt } = body;
    if (!portraitPrompt?.trim()) {
      return NextResponse.json({ error: 'portraitPrompt saknas i anropet.' }, { status: 400 });
    }

    // 2. Validate API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY är inte konfigurerad på servern.' },
        { status: 500 }
      );
    }

    // 3. Call Gemini image generation
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image' });

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: portraitPrompt.trim() }] }],
        // responseModalities is a newer SDK field — cast to avoid type mismatch
        generationConfig: {
          responseModalities: ['IMAGE'],
        } as unknown as Parameters<typeof model.generateContent>[0] extends { generationConfig?: infer C } ? C : never,
      });
    } catch (genError: unknown) {
      console.error('Gemini image generation error:', genError);
      const message = genError instanceof Error ? genError.message : 'Okänt Gemini-fel';
      return NextResponse.json(
        { error: `Bildgenerering misslyckades: ${message}` },
        { status: 502 }
      );
    }

    // 4. Extract image from response
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p) => (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData?.mimeType?.startsWith('image/')
    ) as { inlineData?: { mimeType?: string; data?: string } } | undefined;

    if (!imagePart?.inlineData?.data) {
      return NextResponse.json(
        { error: 'Modellen returnerade ingen bild. Försök igen med en annan beskrivning.' },
        { status: 502 }
      );
    }

    const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
    const imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;

    return NextResponse.json({ imageUrl });
  } catch (error: unknown) {
    console.error('Unexpected error in /api/generate-portrait:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
