import { NextRequest, NextResponse } from 'next/server';
import { getPersona, setPersona } from '@shared';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: { imageUrl: string };
    try {
      body = (await req.json()) as { imageUrl: string };
    } catch {
      return NextResponse.json({ error: 'Ogiltig JSON i förfrågan.' }, { status: 400 });
    }

    const { imageUrl } = body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl saknas eller är ogiltig.' }, { status: 400 });
    }

    const existing = await getPersona();
    const updated = {
      name: existing?.name ?? '',
      description: existing?.description ?? '',
      portrait_url: imageUrl,
    };

    await setPersona(updated);

    return NextResponse.json({ success: true, persona: updated });
  } catch (error: unknown) {
    console.error('Error in POST /api/save-portrait:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
