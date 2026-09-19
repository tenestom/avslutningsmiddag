import { NextResponse } from 'next/server';
import { getAllParticipantIds } from '@shared';

export async function GET(): Promise<NextResponse> {
  try {
    const ids = await getAllParticipantIds();
    return NextResponse.json({ count: ids.length });
  } catch (error: unknown) {
    console.error('Error fetching participant count:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Internt serverfel: ${message}` }, { status: 500 });
  }
}
