import { NextResponse } from 'next/server';
import { resetAllData } from '@shared';

export async function POST(): Promise<NextResponse> {
  try {
    const summary = await resetAllData();
    return NextResponse.json({
      ok: true,
      participantsDeleted: summary.participantsDeleted,
      qaEntriesDeleted: summary.qaEntriesDeleted,
    });
  } catch (error: unknown) {
    console.error('Error in /api/admin/reset:', error);
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json(
      { ok: false, error: `Nollställning misslyckades: ${message}` },
      { status: 500 }
    );
  }
}
