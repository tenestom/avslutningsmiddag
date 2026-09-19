import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-50 font-sans">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
          Organizer Dashboard
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Avslutningsmiddag Admin
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Kontrollrum för att generera, testa och finjustera AI-personan inför middagen.
        </p>

        <div className="mt-8 space-y-4">
          <Link
            href="/test"
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Gå till testmiljö &rarr;
          </Link>

          <p className="text-center text-xs text-zinc-500">
            Live Q&amp;A och slutgiltig video kommer i nästa steg
          </p>
        </div>
      </main>
    </div>
  );
}
