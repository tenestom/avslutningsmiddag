import type { Participant } from "@shared";

export default function ParticipantHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-50 font-sans">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          Participant Portal
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Avslutningsmiddag
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Welcome to the course closing dinner! This application will allow you to share your reflections, submit questions, and interact with the dinner AI persona.
        </p>
        <div className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center">
          <p className="text-xs text-zinc-500">
            Scaffolding ready &middot; Form &amp; Persona Chat arriving soon
          </p>
        </div>
      </main>
    </div>
  );
}
