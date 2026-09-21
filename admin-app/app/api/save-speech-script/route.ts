import { NextRequest, NextResponse } from 'next/server';
import { getSpeech, setSpeech } from '@shared';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: { script: string };
    try {
      body = (await req.json()) as { script: string };
    } catch {
      return NextResponse.json({ error: 'Ogiltig JSON i förfrågan.' }, { status: 400 });
    }

    const { script } = body;
    if (typeof script !== 'string') {
      return NextResponse.json({ error: 'script saknas eller är ogiltigt.' }, { status: 400 });
    }

    const existing = await getSpeech();
    // If status was 'ready' (a final video exists for old script), reset to 'draft' as script changed
    const status = existing?.status === 'ready' ? 'draft' : (existing?.status ?? 'draft');
    const video_url = existing?.video_url ?? null;

    const updated = {
      script,
      video_url,
      status,
    };

    await setSpeech(updated);

    return NextResponse.json({ success: true, speech: updated });
  } catch (error: unknown) {
    console.error('Error in POST /api/save-speech-script:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
