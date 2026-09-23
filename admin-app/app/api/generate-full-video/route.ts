import { NextRequest, NextResponse } from 'next/server';
import { uploadAssetToHeyGen, createHeygenVideo, getHeygenVideoStatus } from '@shared/heygenClient';

// ---------------------------------------------------------------------------
// Accepted resolution values for HeyGen Avatar IV Photo Avatar
// ---------------------------------------------------------------------------
const SUPPORTED_RESOLUTIONS = ['720p', '1080p', '4k'] as const;
type Resolution = (typeof SUPPORTED_RESOLUTIONS)[number];

// ---------------------------------------------------------------------------
// POST — upload image to HeyGen, submit video job using pre-uploaded audioAssetId
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HEYGEN_API_KEY är inte konfigurerad på servern. Lägg till den i .env.local.' },
        { status: 500 }
      );
    }

    // audioAssetId is the HeyGen asset_id returned from /api/generate-full-audio or
    // /api/generate-audio-snippet — already uploaded server-to-server, so we skip re-uploading
    // the raw audio here (which would exceed Vercel's ~4.5 MB request body limit for long speech).
    let body: { imageUrl: string; audioAssetId: string; resolution: string };
    try {
      body = (await req.json()) as { imageUrl: string; audioAssetId: string; resolution: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    const { imageUrl, audioAssetId, resolution } = body;

    if (!imageUrl?.startsWith('data:')) {
      return NextResponse.json(
        { error: 'imageUrl saknas eller är inte en giltig base64 data URL.' },
        { status: 400 }
      );
    }
    if (!audioAssetId?.trim()) {
      return NextResponse.json(
        { error: 'audioAssetId saknas. Generera rösten i Steg 1 först.' },
        { status: 400 }
      );
    }
    if (!SUPPORTED_RESOLUTIONS.includes(resolution as Resolution)) {
      return NextResponse.json(
        { error: `Ogiltig upplösning. Tillåtna värden: ${SUPPORTED_RESOLUTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Upload portrait image to HeyGen (images are small, well within body limits)
    let imageAssetId: string;
    try {
      const result = await uploadAssetToHeyGen(imageUrl, apiKey);
      imageAssetId = result.assetId;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Okänt fel';
      console.error('HeyGen image upload error:', msg);
      return NextResponse.json(
        { error: `Bilduppladdning till HeyGen misslyckades: ${msg}` },
        { status: 502 }
      );
    }

    // Submit video job (non-blocking — returns videoId immediately)
    let videoId: string;
    try {
      videoId = await createHeygenVideo({ imageAssetId, audioAssetId, resolution, apiKey });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Okänt HeyGen-fel';
      console.error('HeyGen createVideo error:', msg);
      return NextResponse.json(
        { error: `Videojobb kunde inte skapas hos HeyGen: ${msg}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ videoId });
  } catch (error: unknown) {
    console.error('Unexpected error in POST /api/generate-full-video:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET ?videoId=xxx — poll HeyGen job status; map to normalised status shape
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'HEYGEN_API_KEY är inte konfigurerad.' }, { status: 500 });
    }

    const videoId = req.nextUrl.searchParams.get('videoId');
    if (!videoId) {
      return NextResponse.json({ error: 'videoId saknas i URL-parametern.' }, { status: 400 });
    }

    let heygenStatus: Awaited<ReturnType<typeof getHeygenVideoStatus>>;
    try {
      heygenStatus = await getHeygenVideoStatus(videoId, apiKey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Okänt fel';
      console.error('HeyGen status check error:', msg);
      return NextResponse.json(
        { status: 'FAILED', error: `Statuskontroll misslyckades: ${msg}` },
        { status: 502 }
      );
    }

    // Map HeyGen statuses → our normalised values
    if (heygenStatus.status === 'completed') {
      const videoUrl = heygenStatus.video_url;
      if (!videoUrl) {
        return NextResponse.json({
          status: 'FAILED',
          error: 'HeyGen returnerade inget video-URL i resultatet.',
        });
      }
      return NextResponse.json({ status: 'COMPLETED', videoUrl });
    }

    if (heygenStatus.status === 'failed') {
      return NextResponse.json({
        status: 'FAILED',
        error: heygenStatus.failure_message ?? 'Videogenerering misslyckades hos HeyGen.',
      });
    }

    // 'pending' | 'processing' → keep polling
    return NextResponse.json({ status: 'IN_PROGRESS' });
  } catch (error: unknown) {
    console.error('Unexpected error in GET /api/generate-full-video:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json(
      { status: 'FAILED', error: `Internt serverfel: ${message}` },
      { status: 500 }
    );
  }
}
