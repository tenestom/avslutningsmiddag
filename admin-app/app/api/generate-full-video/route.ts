import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

// ---------------------------------------------------------------------------
// Resolution tiers (using confirmed fal.ai video_size enum values)
// Pixel dims used for cost display only — the model auto-handles actual frames.
// LTX-2-19B audio-to-video uses match_audio_length, so frame count is derived
// from audio duration. We pass video_size as the resolution hint.
// ---------------------------------------------------------------------------
const SUPPORTED_RESOLUTIONS = ['landscape_16_9', 'portrait_4_3', 'square_hd'] as const;
type Resolution = (typeof SUPPORTED_RESOLUTIONS)[number];

// fal.ai result shape for audio-to-video
interface FalVideoOutput {
  video: { url: string };
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const byteArray = Buffer.from(base64Data, 'base64');
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

// ---------------------------------------------------------------------------
// POST — submit job to fal.queue, return requestId immediately
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY är inte konfigurerad på servern. Lägg till den i .env.local.' },
        { status: 500 }
      );
    }
    fal.config({ credentials: falKey });

    let body: { imageUrl: string; audioUrl: string; resolution: string };
    try {
      body = (await req.json()) as { imageUrl: string; audioUrl: string; resolution: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { imageUrl, audioUrl, resolution } = body;

    if (!imageUrl?.startsWith('data:')) {
      return NextResponse.json({ error: 'imageUrl saknas eller är inte en giltig base64 data URL.' }, { status: 400 });
    }
    if (!audioUrl?.startsWith('data:')) {
      return NextResponse.json({ error: 'audioUrl saknas eller är inte en giltig base64 data URL.' }, { status: 400 });
    }
    if (!SUPPORTED_RESOLUTIONS.includes(resolution as Resolution)) {
      return NextResponse.json(
        { error: `Ogiltig upplösning. Tillåtna värden: ${SUPPORTED_RESOLUTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Upload image and audio to fal storage
    let uploadedImageUrl: string;
    let uploadedAudioUrl: string;

    try {
      uploadedImageUrl = await fal.storage.upload(dataUrlToFile(imageUrl, 'portrait.png'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Okänt fel';
      return NextResponse.json({ error: `Bilduppladdning till fal.ai misslyckades: ${msg}` }, { status: 502 });
    }

    try {
      uploadedAudioUrl = await fal.storage.upload(dataUrlToFile(audioUrl, 'audio.wav'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Okänt fel';
      return NextResponse.json({ error: `Ljuduppladdning till fal.ai misslyckades: ${msg}` }, { status: 502 });
    }

    // Submit to fal.queue (non-blocking — returns requestId immediately)
    let submitted: { request_id: string };
    try {
      submitted = await fal.queue.submit('fal-ai/ltx-2-19b/audio-to-video', {
        input: {
          prompt:
            'A person speaking directly and expressively to the camera, mouth moving naturally in sync with speech, animated facial expressions, natural head movement and blinking, engaged and lively delivery.',
          audio_url: uploadedAudioUrl,
          image_url: uploadedImageUrl,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          video_size: resolution as any,
          match_audio_length: true,
        },
      });
    } catch (e: any) {
      console.error('fal.queue.submit error:', JSON.stringify(e?.body, null, 2));
      const msg = e instanceof Error ? e.message : 'Okänt fal.ai-fel';
      const debug = e?.body?.detail ? JSON.stringify(e.body.detail, null, 2) : undefined;
      return NextResponse.json({ error: `Videojobb kunde inte skickas in: ${msg}`, debug }, { status: 502 });
    }

    return NextResponse.json({ requestId: submitted.request_id });
  } catch (error: unknown) {
    console.error('Unexpected error in POST /api/generate-full-video:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET ?requestId=xxx — poll job status; on COMPLETED, fetch result
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: 'FAL_KEY är inte konfigurerad.' }, { status: 500 });
    }
    fal.config({ credentials: falKey });

    const requestId = req.nextUrl.searchParams.get('requestId');
    if (!requestId) {
      return NextResponse.json({ error: 'requestId saknas i URL-parametern.' }, { status: 400 });
    }

    let queueStatus: { status: string };
    try {
      queueStatus = await fal.queue.status('fal-ai/ltx-2-19b/audio-to-video', { requestId });
    } catch (e: any) {
      console.error('fal.queue.status error:', JSON.stringify(e?.body, null, 2));
      const msg = e instanceof Error ? e.message : 'Okänt fel';
      return NextResponse.json({ status: 'FAILED', error: `Statuskontroll misslyckades: ${msg}` }, { status: 502 });
    }

    const status = queueStatus.status; // "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"

    if (status === 'COMPLETED') {
      let result: { data: FalVideoOutput };
      try {
        result = (await fal.queue.result('fal-ai/ltx-2-19b/audio-to-video', { requestId })) as {
          data: FalVideoOutput;
        };
      } catch (e: any) {
        console.error('fal.queue.result error:', JSON.stringify(e?.body, null, 2));
        const msg = e instanceof Error ? e.message : 'Okänt fel';
        return NextResponse.json({ status: 'FAILED', error: `Resultathämtning misslyckades: ${msg}` });
      }

      const videoUrl = result?.data?.video?.url;
      if (!videoUrl) {
        return NextResponse.json({
          status: 'FAILED',
          error: 'fal.ai returnerade inget video-URL i resultatet.',
        });
      }

      return NextResponse.json({ status: 'COMPLETED', videoUrl });
    }

    // IN_QUEUE or IN_PROGRESS
    return NextResponse.json({ status: 'IN_PROGRESS' });
  } catch (error: unknown) {
    console.error('Unexpected error in GET /api/generate-full-video:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ status: 'FAILED', error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
