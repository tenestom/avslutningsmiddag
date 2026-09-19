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

        <div className="mt-8 space-y-3">
          {/* Real admin environment — primary CTA */}
          <Link
            href="/admin"
            className="flex items-center justify-between gap-2 rounded-xl bg-amber-500 px-6 py-4 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-700">Skarpt läge</span>
              </div>
              <span>Gå till adminmiljö</span>
            </div>
            <span className="text-lg">&rarr;</span>
          </Link>

          {/* Test environment — secondary */}
          <Link
            href="/test"
            className="flex items-center justify-between gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-4 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-violet-500 mb-0.5">Testmiljö</div>
              <span>Gå till testmiljö (fiktiv data)</span>
            </div>
            <span className="text-lg">&rarr;</span>
          </Link>

          <p className="text-center text-xs text-zinc-500 pt-1">
            Live Q&amp;A och slutgiltig video kommer i nästa steg
          </p>
        </div>
      </main>
    </div>
  );
}
