import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

// ---------------------------------------------------------------------------
// Helper: convert a base64 data URL to a File object for fal.storage.upload
// ---------------------------------------------------------------------------
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const byteArray = Buffer.from(base64Data, 'base64');
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

// fal.ai result shape for fal-ai/ltx-2-19b/distilled/audio-to-video
interface FalVideoOutput {
  video: { url: string };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Validate fal.ai key
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        {
          error:
            'FAL_KEY är inte konfigurerad på servern. Lägg till den i .env.local och starta om servern.',
        },
        { status: 500 }
      );
    }

    // Configure fal client with the server-side key
    fal.config({ credentials: falKey });

    // 2. Parse request body
    let body: { imageUrl: string; audioUrl: string };
    try {
      body = (await req.json()) as { imageUrl: string; audioUrl: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { imageUrl, audioUrl } = body;
    if (!imageUrl?.startsWith('data:')) {
      return NextResponse.json(
        { error: 'imageUrl saknas eller är inte en giltig base64 data URL.' },
        { status: 400 }
      );
    }
    if (!audioUrl?.startsWith('data:')) {
      return NextResponse.json(
        { error: 'audioUrl saknas eller är inte en giltig base64 data URL.' },
        { status: 400 }
      );
    }

    // 3. Upload image and audio to fal.ai storage (requires hosted URLs, not base64)
    let uploadedImageUrl: string;
    let uploadedAudioUrl: string;

    try {
      const imageFile = dataUrlToFile(imageUrl, 'portrait.png');
      uploadedImageUrl = await fal.storage.upload(imageFile);
    } catch (uploadError: unknown) {
      console.error('fal.storage.upload (image) error:', uploadError);
      const message = uploadError instanceof Error ? uploadError.message : 'Okänt fel';
      return NextResponse.json(
        { error: `Misslyckades med att ladda upp bild till fal.ai: ${message}` },
        { status: 502 }
      );
    }

    try {
      const audioFile = dataUrlToFile(audioUrl, 'audio.wav');
      uploadedAudioUrl = await fal.storage.upload(audioFile);
    } catch (uploadError: unknown) {
      console.error('fal.storage.upload (audio) error:', uploadError);
      const message = uploadError instanceof Error ? uploadError.message : 'Okänt fel';
      return NextResponse.json(
        { error: `Misslyckades med att ladda upp ljud till fal.ai: ${message}` },
        { status: 502 }
      );
    }

    // 4. Call fal.ai lip-sync model
    let result: { data: FalVideoOutput };
    try {
      result = (await fal.subscribe('fal-ai/ltx-2-19b/distilled/audio-to-video', {
        input: {
          prompt:
            'A person speaks naturally to the camera, direct eye contact, subtle head movement.',
          audio_url: uploadedAudioUrl,
          image_url: uploadedImageUrl,
          match_audio_length: true,
        },
        logs: true,
      })) as { data: FalVideoOutput };
    } catch (falError: unknown) {
      console.error('fal.subscribe error:', falError);
      const message = falError instanceof Error ? falError.message : 'Okänt fal.ai-fel';
      // Detect common auth error patterns
      if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('403')) {
        return NextResponse.json(
          {
            error:
              'fal.ai-nyckeln är ogiltig eller har inte behörighet. Kontrollera FAL_KEY i .env.local.',
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Videogenerering misslyckades: ${message}` },
        { status: 502 }
      );
    }

    // 5. Extract video URL
    const videoUrl = result?.data?.video?.url;
    if (!videoUrl) {
      console.error('Unexpected fal.ai response shape:', JSON.stringify(result));
      return NextResponse.json(
        { error: 'fal.ai returnerade inget video-URL. Kontrollera serverloggen för detaljer.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ videoUrl });
  } catch (error: unknown) {
    console.error('Unexpected error in /api/generate-video-snippet:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
