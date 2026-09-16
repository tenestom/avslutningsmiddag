'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface GenerationResult {
  personaName: string;
  personaDescription: string;
  portraitPrompt: string;
  speechScript: string;
  toneUsed: string;
  generatedAt: string;
}

interface ApiError {
  error: string;
  rawResponse?: string;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Extract the first 1-2 sentences from a speech script for the snippet test. */
function getFirstTwoSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?\u2026]+/g) ?? [];
  const snippet = sentences.slice(0, 2).join(' ').trim();
  return snippet || text.slice(0, 300).trim();
}

/** Estimate cost for a snippet based on character count (rough $0.02–0.04/sec). */
function estimateCost(text: string): string {
  // ~15 chars/second for spoken Swedish
  const seconds = Math.max(3, Math.round(text.length / 15));
  const low = (seconds * 0.02).toFixed(2);
  const high = (seconds * 0.04).toFixed(2);
  return `$${low}–$${high}`;
}

// ---------------------------------------------------------------------------
// Reusable UI primitives
// ---------------------------------------------------------------------------

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <svg
          className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar test section (embedded in each ResultCard)
// ---------------------------------------------------------------------------

type VideoStep = 'audio' | 'video' | null;

interface AvatarState {
  snippetText: string;
  isGeneratingPortrait: boolean;
  portraitError: string | null;
  portraitImageUrl: string | null;
  videoStep: VideoStep;
  videoError: string | null;
  videoUrl: string | null;
}

function AvatarTestSection({ result }: { result: GenerationResult }) {
  const [state, setState] = useState<AvatarState>({
    snippetText: getFirstTwoSentences(result.speechScript),
    isGeneratingPortrait: false,
    portraitError: null,
    portraitImageUrl: null,
    videoStep: null,
    videoError: null,
    videoUrl: null,
  });

  const patch = (updates: Partial<AvatarState>) =>
    setState((prev) => ({ ...prev, ...updates }));

  // ── Generate portrait ────────────────────────────────────────────────────
  const handleGeneratePortrait = async () => {
    patch({ isGeneratingPortrait: true, portraitError: null });
    try {
      const res = await fetch('/api/generate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portraitPrompt: result.portraitPrompt }),
      });
      const data = (await res.json()) as { imageUrl?: string } & Partial<ApiError>;
      if (!res.ok || data.error) {
        patch({ portraitError: data.error ?? 'Okänt fel vid bildgenerering.' });
      } else {
        patch({ portraitImageUrl: data.imageUrl ?? null });
      }
    } catch {
      patch({ portraitError: 'Kunde inte nå /api/generate-portrait. Kontrollera att servern körs.' });
    } finally {
      patch({ isGeneratingPortrait: false });
    }
  };

  // ── Generate voice + video ───────────────────────────────────────────────
  const handleGenerateVideo = async () => {
    if (!state.portraitImageUrl) return;
    patch({ videoStep: 'audio', videoError: null, videoUrl: null });

    let audioUrl: string;
    try {
      const audioRes = await fetch('/api/generate-audio-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: state.snippetText }),
      });
      const audioData = (await audioRes.json()) as { audioUrl?: string } & Partial<ApiError>;
      if (!audioRes.ok || audioData.error) {
        patch({ videoStep: null, videoError: audioData.error ?? 'Okänt fel vid röstsyntes.' });
        return;
      }
      audioUrl = audioData.audioUrl!;
    } catch {
      patch({ videoStep: null, videoError: 'Kunde inte nå /api/generate-audio-snippet.' });
      return;
    }

    patch({ videoStep: 'video' });

    try {
      const videoRes = await fetch('/api/generate-video-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: state.portraitImageUrl,
          audioUrl,
        }),
      });
      const videoData = (await videoRes.json()) as { videoUrl?: string } & Partial<ApiError>;
      if (!videoRes.ok || videoData.error) {
        patch({ videoStep: null, videoError: videoData.error ?? 'Okänt fel vid videogenerering.' });
        return;
      }
      patch({ videoUrl: videoData.videoUrl ?? null });
    } catch {
      patch({ videoStep: null, videoError: 'Kunde inte nå /api/generate-video-snippet.' });
    } finally {
      patch({ videoStep: null });
    }
  };

  const isGeneratingVideo = state.videoStep !== null;
  const videoStepLabel =
    state.videoStep === 'audio'
      ? 'Genererar röst…'
      : state.videoStep === 'video'
      ? 'Genererar video… (kan ta upp till en minut)'
      : null;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/30 p-5 sm:p-6 space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
          Testa avatar (kort klipp)
        </span>
        <div className="flex-1 border-t border-zinc-800/80" />
      </div>

      {/* Snippet textarea */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-zinc-400">
          Textutdrag att testa{' '}
          <span className="font-normal text-zinc-600">(redigera fritt — välj ett kort stycke)</span>
        </label>
        <textarea
          rows={3}
          value={state.snippetText}
          onChange={(e) => patch({ snippetText: e.target.value })}
          className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      {/* Step 1: Generate portrait */}
      <div className="space-y-3">
        <button
          onClick={handleGeneratePortrait}
          disabled={state.isGeneratingPortrait}
          className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.isGeneratingPortrait ? (
            <>
              <Spinner className="h-4 w-4" />
              <span>Genererar porträtt…</span>
            </>
          ) : state.portraitImageUrl ? (
            <span>Generera nytt porträtt</span>
          ) : (
            <span>Generera porträtt</span>
          )}
        </button>

        {state.portraitError && <ErrorAlert message={state.portraitError} />}

        {state.portraitImageUrl && (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.portraitImageUrl}
              alt={`Porträtt av ${result.personaName}`}
              className="w-full max-w-xs rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Step 2: Generate voice + video — only visible once portrait exists */}
      {state.portraitImageUrl && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || !state.snippetText.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingVideo ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>{videoStepLabel}</span>
                </>
              ) : (
                <span>Generera röst + video (kort test)</span>
              )}
            </button>

            {/* Cost estimate */}
            <span className="text-xs text-zinc-500">
              Kort test ≈ {estimateCost(state.snippetText)}
            </span>
          </div>

          {state.videoError && <ErrorAlert message={state.videoError} />}

          {state.videoUrl && (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <video
                src={state.videoUrl}
                controls
                className="w-full max-w-md rounded-xl"
                playsInline
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultCard
// ---------------------------------------------------------------------------

function ResultCard({ result, index }: { result: GenerationResult; index: number }) {
  const [speechExpanded, setSpeechExpanded] = useState(true);
  const [portraitPromptExpanded, setPortraitPromptExpanded] = useState(false);

  const paragraphs = result.speechScript
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">
      {/* Result header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-5 py-3">
        <div className="flex items-center gap-2">
          {index === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Senaste
            </span>
          )}
          <span className="text-xs text-zinc-500">{result.generatedAt}</span>
        </div>
        {result.toneUsed && (
          <span className="hidden sm:block text-xs text-zinc-500 italic">
            Ton: &ldquo;{result.toneUsed.slice(0, 60)}{result.toneUsed.length > 60 ? '…' : ''}&rdquo;
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Persona card */}
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-950/40 p-4 sm:p-5">
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Persona
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {result.personaName}
          </h2>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-zinc-300">
            {result.personaDescription}
          </p>
        </div>

        {/* Portrait prompt (collapsible) */}
        <div>
          <button
            onClick={() => setPortraitPromptExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-300 transition"
          >
            <span className="font-medium">Porträttbeskrivning (för bildgenerering)</span>
            <svg
              className={`h-4 w-4 transition-transform ${portraitPromptExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {portraitPromptExpanded && (
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-sm text-zinc-300 leading-relaxed italic">{result.portraitPrompt}</p>
            </div>
          )}
        </div>

        {/* Speech script (collapsible) */}
        <div>
          <button
            onClick={() => setSpeechExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-700/60 bg-zinc-950/40 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white transition"
          >
            <span className="font-semibold">Talskript</span>
            <svg
              className={`h-4 w-4 transition-transform ${speechExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {speechExpanded && (
            <div className="mt-3 space-y-4 rounded-xl border border-zinc-700/40 bg-zinc-950/60 p-5">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-sm sm:text-base leading-[1.8] text-zinc-200">
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Avatar test subsection */}
      <AvatarTestSection result={result} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TestPage() {
  const [toneInstructions, setToneInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResult[]>([]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useTestData: true,
          toneInstructions: toneInstructions.trim() || undefined,
        }),
      });

      const data = (await response.json()) as
        | (Omit<GenerationResult, 'toneUsed' | 'generatedAt'> & Record<string, unknown>)
        | ApiError;

      if (!response.ok || 'error' in data) {
        const errData = data as ApiError;
        setError(errData.error ?? 'Okänt fel från servern.');
        return;
      }

      const resultData = data as Omit<GenerationResult, 'toneUsed' | 'generatedAt'>;
      const newResult: GenerationResult = {
        ...resultData,
        toneUsed: toneInstructions.trim(),
        generatedAt: new Date().toLocaleString('sv-SE', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      // Prepend newest first
      setResults((prev) => [newResult, ...prev]);
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      setError(
        'Kunde inte nå servern. Kontrollera att GEMINI_API_KEY är satt i .env.local och att servern körs.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <header>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Adminverktyg
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Persona &amp; talsgenerator
          </h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Testmiljö för att iterera på prompt, ton och avatarkvalitet. Text genereras med Gemini;
            portätt och röst med Gemini Image/TTS; video med fal.ai LTX-2 (betalning per användning).
          </p>
        </header>

        {/* Test data badge */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <svg
            className="h-5 w-5 flex-shrink-0 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.607L5 14.5m14.8.5-1.5.4M5 14.5l-1.5.4"
            />
          </svg>
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">Testläge:</span>{' '}
            använder 20 fiktiva svar från{' '}
            <code className="text-xs text-amber-400 bg-zinc-800 rounded px-1 py-0.5">
              test-data/fixtures.ts
            </code>
          </p>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 space-y-5 shadow-xl backdrop-blur">
          <div className="space-y-2">
            <label htmlFor="tone" className="block text-sm font-semibold text-zinc-200">
              Ton-instruktion{' '}
              <span className="text-xs font-normal text-zinc-500">(valfritt)</span>
            </label>
            <textarea
              id="tone"
              rows={3}
              value={toneInstructions}
              onChange={(e) => setToneInstructions(e.target.value)}
              placeholder={'T.ex. "Mer militär och allvarlig ton, mindre humor" eller "Håll det extra roligt och lite absurdistiskt"'}
              className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-white placeholder-zinc-600 transition focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <p className="text-xs text-zinc-500">
              Skickas direkt till modellen som stilinstruktion. Lämna tomt för att använda
              standardpromptens ton.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-6 py-4 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Spinner />
                <span>Genererar… (kan ta 15–30 s)</span>
              </>
            ) : results.length > 0 ? (
              <span>Kör igen</span>
            ) : (
              <span>Generera persona &amp; tal</span>
            )}
          </button>

          {/* Top-level error */}
          {error && <ErrorAlert message={error} />}
        </div>

        {/* Results — newest first */}
        {results.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Genererade resultat
              </h2>
              <div className="flex-1 border-t border-zinc-800" />
              <span className="text-xs text-zinc-600">{results.length} st</span>
            </div>
            {results.map((r, i) => (
              <ResultCard key={i} result={r} index={i} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
