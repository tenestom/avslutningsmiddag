import { NextRequest, NextResponse } from 'next/server';
import { uploadAssetToHeyGen } from '@shared/heygenClient';

/**
 * POST /api/upload-audio-asset
 *
 * Accepts a base64 audio data URL from the client (e.g. a user-uploaded file)
 * and uploads it to HeyGen's asset storage server-to-server.
 *
 * Returns { audioAssetId, audioUrl } — the same shape as generate-full-audio
 * and generate-audio-snippet, so Steg 2 can pass audioAssetId directly to the
 * video generation routes without re-uploading.
 *
 * This avoids storing large base64 blobs in client state AND avoids sending
 * them from client → server in the video generation request.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HEYGEN_API_KEY är inte konfigurerad på servern.' },
        { status: 500 }
      );
    }

    let body: { audioDataUrl: string };
    try {
      body = (await req.json()) as { audioDataUrl: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { audioDataUrl } = body;
    if (!audioDataUrl?.startsWith('data:audio/')) {
      return NextResponse.json(
        { error: 'audioDataUrl saknas eller är inte en giltig audio data URL.' },
        { status: 400 }
      );
    }

    let audioAssetId: string;
    let audioUrl: string;
    try {
      const uploaded = await uploadAssetToHeyGen(audioDataUrl, apiKey);
      audioAssetId = uploaded.assetId;
      audioUrl = uploaded.url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Okänt fel';
      console.error('HeyGen audio asset upload error:', msg);
      return NextResponse.json(
        { error: `Ljuduppladdning till HeyGen misslyckades: ${msg}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ audioAssetId, audioUrl });
  } catch (error: unknown) {
    console.error('Unexpected error in POST /api/upload-audio-asset:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
