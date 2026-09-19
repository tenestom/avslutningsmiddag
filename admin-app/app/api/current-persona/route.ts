import { NextResponse } from 'next/server';
import { getPersona, getSpeech } from '@shared';

export async function GET(): Promise<NextResponse> {
  try {
    const [persona, speech] = await Promise.all([getPersona(), getSpeech()]);
    return NextResponse.json({ persona: persona ?? null, speech: speech ?? null });
  } catch (error: unknown) {
    console.error('Error fetching current persona/speech:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
