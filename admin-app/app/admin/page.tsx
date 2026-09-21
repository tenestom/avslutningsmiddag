'use client';

import { useState, useEffect } from 'react';
import { setSpeech as kvSetSpeech } from '@shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerationResult {
  personaName: string;
  personaDescription: string;
  portraitPrompt: string;
  speechScript: string;
}

interface ApiError {
  error: string;
  rawResponse?: string;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function getFirstTwoSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?\u2026]+/g) ?? [];
  const snippet = sentences.slice(0, 2).join(' ').trim();
  return snippet || text.slice(0, 300).trim();
}

// HeyGen Avatar IV Photo Avatar: $0.0385/sec
function computeCost(durationSeconds: number): string {
  const cost = durationSeconds * 0.0385;
  return `$${cost.toFixed(2)}`;
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

function VoiceSelect({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: 'amber' | 'red';
}) {
  const ring = accent === 'amber' ? 'focus:ring-amber-500/30' : 'focus:ring-red-500/30';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-200 transition focus:border-zinc-700 focus:outline-none focus:ring-2 ${ring}`}
    >
      <option value="Kore">Kore (kvinna, bestämd)</option>
      <option value="Puck">Puck (man, pigg)</option>
      <option value="Charon">Charon (man, informativ)</option>
      <option value="Aoede">Aoede (kvinna, lätt)</option>
      <option value="Orus">Orus (man, bestämd)</option>
      <option value="Leda">Leda (kvinna, ungdomlig)</option>
    </select>
  );
}

// ---------------------------------------------------------------------------
// SHARED PORTRAIT SECTION (top-level, persisted)
// ---------------------------------------------------------------------------

type PortraitSource = 'ai' | 'upload';

function PortraitSection({
  portraitPrompt,
  portraitImageUrl,
  onPortraitChange,
  sectionId,
}: {
  portraitPrompt: string;
  portraitImageUrl: string | null;
  onPortraitChange: (url: string) => void;
  sectionId?: string;
}) {
  const [source, setSource] = useState<PortraitSource>(portraitImageUrl ? 'upload' : 'ai');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError(`Bilden är för stor (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 10 MB.`);
      return;
    }
    const validExt = ['.jpg', '.jpeg', '.png', '.webp'];
    const validMime = ['image/jpeg', 'image/png', 'image/webp'];
    const name = file.name.toLowerCase();
    if (!validExt.some((ext) => name.endsWith(ext)) || !validMime.includes(file.type)) {
      setError('Ogiltigt filformat. Endast JPEG, PNG och WebP accepteras.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onPortraitChange(reader.result);
        setError(null);
      }
    };
    reader.onerror = () => setError('Ett fel uppstod vid inläsning av bilden.');
    reader.readAsDataURL(file);
  };

  const handleGeneratePortrait = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portraitPrompt }),
      });
      const data = (await res.json()) as { imageUrl?: string } & Partial<ApiError>;
      if (!res.ok || data.error) {
        setError(data.error ?? 'Okänt fel vid bildgenerering.');
      } else if (data.imageUrl) {
        onPortraitChange(data.imageUrl);
      }
    } catch {
      setError('Kunde inte nå /api/generate-portrait.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id={sectionId} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Porträtt</span>
        <div className="flex-1 border-t border-zinc-800/80" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-zinc-400">Porträttkälla</label>
        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1">
          <button
            type="button"
            onClick={() => { setSource('ai'); setError(null); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              source === 'ai' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI-genererat porträtt
          </button>
          <button
            type="button"
            onClick={() => { setSource('upload'); setError(null); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              source === 'upload' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Ladda upp egen bild
          </button>
        </div>
      </div>

      {source === 'ai' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 italic">{portraitPrompt || 'Ingen portrattprompt tillgänglig.'}</p>
          <button
            onClick={handleGeneratePortrait}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>Genererar porträtt…</span>
              </>
            ) : portraitImageUrl ? (
              <span>Generera nytt porträtt</span>
            ) : (
              <span>Generera porträtt</span>
            )}
          </button>
        </div>
      )}

      {source === 'upload' && (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-300">Ladda upp egen bild</label>
            <p className="text-xs text-zinc-500">Stöder JPEG, PNG och WebP (max 10 MB).</p>
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={handleImageUpload}
            className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-zinc-950 hover:file:bg-amber-400 file:cursor-pointer cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/80 p-2"
          />
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {portraitImageUrl && (
        <div className="overflow-hidden rounded-xl border border-zinc-800 max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portraitImageUrl} alt="Aktivt porträtt" className="w-full rounded-xl" />
        </div>
      )}
      {!portraitImageUrl && (
        <p className="text-xs text-zinc-600 italic">Inget porträtt valt ännu.</p>
      )}
    </div>
  );
}

// Portrait badge shown inside sub-sections
function PortraitBadge({ portraitImageUrl, sectionId }: { portraitImageUrl: string | null; sectionId: string }) {
  return (
    <div className="flex items-center gap-3">
      {portraitImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={portraitImageUrl}
            alt="Aktivt porträtt"
            className="h-12 w-12 rounded-lg object-cover border border-zinc-700 flex-shrink-0"
          />
          <div className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Aktivt porträtt</span>
            <br />
            <a href={`#${sectionId}`} className="text-amber-400 hover:underline">
              Byt porträtt ↑
            </a>
          </div>
        </>
      ) : (
        <p className="text-xs text-amber-400">
          Inget porträtt valt.{' '}
          <a href={`#${sectionId}`} className="underline hover:text-amber-300">
            Välj porträtt ↑
          </a>{' '}
          för att kunna generera video.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SNIPPET TEST SECTION (kort klipp, redigera fritt)
// ---------------------------------------------------------------------------

type AudioSource = 'tts' | 'upload';
type SnippetAudioStep = 'idle' | 'generating' | 'ready';
type SnippetVideoStep = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

function SnippetTestSection({
  result,
  portraitImageUrl,
  portraitSectionId,
}: {
  result: GenerationResult;
  portraitImageUrl: string | null;
  portraitSectionId: string;
}) {
  // Steg 1: Audio
  const [audioSource, setAudioSource] = useState<AudioSource>('tts');
  const [snippetText, setSnippetText] = useState(() => getFirstTwoSentences(result.speechScript));
  const [voiceName, setVoiceName] = useState('Kore');
  const [audioStep, setAudioStep] = useState<SnippetAudioStep>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Steg 2: Video
  const [videoStep, setVideoStep] = useState<SnippetVideoStep>('idle');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPollElapsed, setVideoPollElapsed] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  // Track which audio produced the current video (stale detection)
  const [videoAudioUrl, setVideoAudioUrl] = useState<string | null>(null);

  const audioStale = videoUrl !== null && audioUrl !== videoAudioUrl;

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setAudioUrl(null);
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`Filen är för stor (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 15 MB.`);
      return;
    }
    const validExt = ['.wav', '.mp3', '.m4a', '.ogg'];
    const validMime = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'application/ogg'];
    if (!validExt.some((ext) => file.name.toLowerCase().endsWith(ext)) && !validMime.includes(file.type)) {
      setUploadError('Ogiltigt filformat. Endast WAV, MP3, M4A och OGG accepteras.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAudioUrl(reader.result);
        setAudioStep('ready');
        setUploadError(null);
      }
    };
    reader.onerror = () => setUploadError('Ett fel uppstod vid inläsning av ljudfilen.');
    reader.readAsDataURL(file);
  };

  const handleGenerateAudio = async () => {
    setAudioStep('generating');
    setAudioError(null);
    try {
      const res = await fetch('/api/generate-audio-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: snippetText, voiceName }),
      });
      const data = (await res.json()) as { audioUrl?: string } & Partial<ApiError>;
      if (!res.ok || data.error) {
        setAudioError(data.error ?? 'Okänt fel vid röstsyntes.');
        setAudioStep('idle');
        return;
      }
      setAudioUrl(data.audioUrl ?? null);
      setAudioStep('ready');
    } catch {
      setAudioError('Kunde inte nå /api/generate-audio-snippet.');
      setAudioStep('idle');
    }
  };

  const handleSubmitVideo = async () => {
    if (!audioUrl || !portraitImageUrl) return;
    setVideoStep('submitting');
    setVideoError(null);
    try {
      const res = await fetch('/api/generate-video-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: portraitImageUrl, audioUrl }),
      });
      const data = (await res.json()) as { videoId?: string; error?: string };
      if (!res.ok || data.error) {
        setVideoStep('error');
        setVideoError(data.error ?? 'Okänt fel vid videoinlämning.');
        return;
      }
      setVideoId(data.videoId ?? null);
      setVideoAudioUrl(audioUrl);
      setVideoStep('polling');
      setVideoPollElapsed(0);
    } catch {
      setVideoStep('error');
      setVideoError('Kunde inte nå /api/generate-video-snippet.');
    }
  };

  useEffect(() => {
    if (videoStep !== 'polling' || !videoId) return;
    const startTime = Date.now();
    const interval = setInterval(async () => {
      setVideoPollElapsed(Math.round((Date.now() - startTime) / 1000));
      try {
        const res = await fetch(`/api/generate-video-snippet?videoId=${videoId}`);
        const data = (await res.json()) as { status: string; videoUrl?: string; error?: string };
        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          setVideoStep('done');
          setVideoUrl(data.videoUrl ?? null);
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setVideoStep('error');
          setVideoError(data.error ?? 'Videogenerering misslyckades.');
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoStep, videoId]);

  // Short clip: estimate cost from snippet text length (~15 chars/s)
  const estimatedSeconds = Math.max(3, Math.round(snippetText.length / 15));

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/30 p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
          Förhandsgranska avatar (kort klipp)
        </span>
        <div className="flex-1 border-t border-zinc-800/80" />
      </div>

      <PortraitBadge portraitImageUrl={portraitImageUrl} sectionId={portraitSectionId} />

      {/* ── STEG 1: Röst ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
            1
          </span>
          <span className="text-sm font-bold text-zinc-200">Generera röst (kort test)</span>
          {audioStep === 'ready' && (
            <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Röst klar</span>
          )}
        </div>

        {/* Source toggle */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-400">Ljudkälla</label>
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1">
            <button
              type="button"
              onClick={() => {
                setAudioSource('tts');
                setAudioUrl(null);
                setUploadError(null);
                setAudioStep('idle');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                audioSource === 'tts' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              AI-genererad röst
            </button>
            <button
              type="button"
              onClick={() => {
                setAudioSource('upload');
                setAudioUrl(null);
                setAudioError(null);
                setAudioStep('idle');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                audioSource === 'upload' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ladda upp eget ljud
            </button>
          </div>
        </div>

        {/* TTS path */}
        {audioSource === 'tts' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">
                  Textutdrag{' '}
                  <span className="font-normal text-zinc-600">(redigera fritt)</span>
                </label>
                <textarea
                  rows={3}
                  value={snippetText}
                  onChange={(e) => setSnippetText(e.target.value)}
                  className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
              <div className="space-y-1.5 sm:w-52">
                <label className="block text-xs font-semibold text-zinc-400">Röst</label>
                <VoiceSelect value={voiceName} onChange={setVoiceName} accent="amber" />
              </div>
            </div>
            {audioStep === 'idle' && (
              <button
                onClick={handleGenerateAudio}
                disabled={!snippetText.trim()}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generera röst
              </button>
            )}
            {audioStep === 'generating' && (
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <Spinner className="h-4 w-4" />
                <span>Genererar röst…</span>
              </div>
            )}
            {audioError && <ErrorAlert message={audioError} />}
          </div>
        )}

        {/* Upload path */}
        {audioSource === 'upload' && audioStep === 'idle' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">
                Ladda upp ljudfil (WAV, MP3, M4A eller OGG — max 15 MB)
              </label>
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.ogg"
                onChange={handleAudioUpload}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-zinc-950 hover:file:bg-amber-400 file:cursor-pointer cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/80 p-2"
              />
            </div>
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          </div>
        )}

        {/* Audio ready: player + "Prova igen" */}
        {audioStep === 'ready' && audioUrl && (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-300 font-medium">Röst klar</p>
              <button
                onClick={() => {
                  setAudioStep('idle');
                  setAudioUrl(null);
                  setAudioError(null);
                  setUploadError(null);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg px-3 py-1.5 transition hover:bg-zinc-800"
              >
                Prova igen
              </button>
            </div>
            <audio src={audioUrl} controls className="w-full h-8" />
          </div>
        )}
      </div>

      {/* ── STEG 2: Video ────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 space-y-4 transition ${
          audioStep !== 'ready'
            ? 'border-zinc-800/50 bg-zinc-900/20 opacity-50 pointer-events-none select-none'
            : 'border-zinc-800 bg-zinc-900/40'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
            2
          </span>
          <span className="text-sm font-bold text-zinc-200">Generera video (kort test)</span>
          {audioStep !== 'ready' && (
            <span className="ml-2 text-xs text-zinc-600">Kräver färdig röst från Steg 1</span>
          )}
          {videoStep === 'done' && !audioStale && (
            <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Video klar</span>
          )}
        </div>

        {audioStale && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            Ljudet har ändrats — generera video på nytt för att matcha det nya ljudet.
          </div>
        )}

        {(videoStep === 'idle') && audioStep === 'ready' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              Beräknad kostnad:{' '}
              <span className="font-bold text-amber-400">{computeCost(estimatedSeconds)}</span>
              <span className="text-zinc-600 ml-1">(HeyGen $0.0385/s, ~{estimatedSeconds}s)</span>
            </p>
            <button
              onClick={handleSubmitVideo}
              disabled={!portraitImageUrl}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generera video (kort test)
            </button>
          </div>
        )}

        {videoStep === 'submitting' && (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Spinner className="h-4 w-4" />
            <span>Skickar in videojobb…</span>
          </div>
        )}

        {videoStep === 'polling' && (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Spinner className="h-4 w-4" />
            <span>Genererar video… ({videoPollElapsed}s)</span>
          </div>
        )}

        {videoStep === 'done' && videoUrl && (
          <div className="space-y-3">
            {audioStale && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
                OBS: Videon genererades med ett tidigare ljud.
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <video src={videoUrl} controls className="w-full max-w-md rounded-xl" playsInline />
            </div>
            <button
              onClick={() => {
                setVideoStep('idle');
                setVideoUrl(null);
                setVideoId(null);
                setVideoAudioUrl(null);
              }}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
            >
              Generera ny video
            </button>
          </div>
        )}

        {videoStep === 'error' && videoError && (
          <div className="space-y-3">
            <ErrorAlert message={videoError} />
            <button
              onClick={() => {
                setVideoStep('idle');
                setVideoError(null);
                setVideoId(null);
                setVideoUrl(null);
              }}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
            >
              Börja om
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FULL VIDEO SECTION — Steg 1 (Röst) + Steg 2 (Video)
// ---------------------------------------------------------------------------

const RESOLUTIONS = [
  { value: '720p',  label: '720p HD',       description: 'Snabbare rendering — bra för test och presentation' },
  { value: '1080p', label: '1080p Full HD',  description: 'Skarp kvalitet — rekommenderas för slutresultat' },
  { value: '4k',    label: '4K Ultra HD',    description: 'Högsta bildkvalitet — tar något längre tid' },
] as const;

type ResolutionValue = (typeof RESOLUTIONS)[number]['value'];
type AudioGenStep = 'idle' | 'generating' | 'ready';
type VideoGenStep = 'idle' | 'confirming' | 'submitting' | 'polling' | 'done' | 'error';

function FullVideoSection({
  speechScript,
  portraitImageUrl,
  portraitSectionId,
  onVideoSaved,
}: {
  speechScript: string;
  portraitImageUrl: string | null;
  portraitSectionId: string;
  onVideoSaved?: (videoUrl: string) => void;
}) {
  // Steg 1
  const [audioSource, setAudioSource] = useState<AudioSource>('tts');
  const [voiceName, setVoiceName] = useState('Kore');
  const [audioStep, setAudioStep] = useState<AudioGenStep>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Steg 2
  const [selectedResolution, setSelectedResolution] = useState<ResolutionValue>('1080p');
  const [videoStep, setVideoStep] = useState<VideoGenStep>('idle');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [videoAudioUrl, setVideoAudioUrl] = useState<string | null>(null);

  const audioStale = videoUrl !== null && audioUrl !== videoAudioUrl;

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setAudioUrl(null);
    setDurationSeconds(null);
    if (file.size > 20 * 1024 * 1024) {
      setUploadError(`Filen är för stor (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 20 MB.`);
      return;
    }
    const validExt = ['.wav', '.mp3', '.m4a', '.ogg'];
    const validMime = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'application/ogg'];
    if (!validExt.some((ext) => file.name.toLowerCase().endsWith(ext)) && !validMime.includes(file.type)) {
      setUploadError('Ogiltigt filformat. Endast WAV, MP3, M4A och OGG accepteras.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const audio = new Audio(dataUrl);
      audio.addEventListener('loadedmetadata', () => {
        const dur = isFinite(audio.duration) ? Math.round(audio.duration) : null;
        setAudioUrl(dataUrl);
        setDurationSeconds(dur);
        setAudioStep('ready');
      });
      audio.addEventListener('error', () => {
        setAudioUrl(dataUrl);
        setDurationSeconds(null);
        setAudioStep('ready');
      });
    };
    reader.onerror = () => setUploadError('Ett fel uppstod vid inläsning av ljudfilen.');
    reader.readAsDataURL(file);
  };

  const handleGenerateAudio = async () => {
    setAudioStep('generating');
    setAudioError(null);
    try {
      const res = await fetch('/api/generate-full-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: speechScript, voiceName }),
      });
      const data = await res.json() as { audioUrl?: string; durationSeconds?: number; error?: string };
      if (!res.ok || data.error) {
        setAudioError(data.error ?? 'Okänt fel vid röstsyntes.');
        setAudioStep('idle');
        return;
      }
      setAudioUrl(data.audioUrl ?? null);
      setDurationSeconds(data.durationSeconds ?? null);
      setAudioStep('ready');
    } catch {
      setAudioError('Kunde inte nå /api/generate-full-audio.');
      setAudioStep('idle');
    }
  };

  const handleSubmitVideo = async () => {
    if (!audioUrl || !portraitImageUrl) return;
    setVideoStep('submitting');
    setVideoError(null);
    try {
      const res = await fetch('/api/generate-full-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: portraitImageUrl, audioUrl, resolution: selectedResolution }),
      });
      const data = await res.json() as { videoId?: string; error?: string };
      if (!res.ok || data.error) {
        setVideoStep('error');
        setVideoError(data.error ?? 'Okänt fel vid videoinlämning.');
        return;
      }
      setVideoId(data.videoId ?? null);
      setVideoAudioUrl(audioUrl);
      setVideoStep('polling');
      setPollElapsed(0);
    } catch {
      setVideoStep('error');
      setVideoError('Kunde inte nå /api/generate-full-video.');
    }
  };

  useEffect(() => {
    if (videoStep !== 'polling' || !videoId) return;
    const startTime = Date.now();
    const interval = setInterval(async () => {
      setPollElapsed(Math.round((Date.now() - startTime) / 1000));
      try {
        const res = await fetch(`/api/generate-full-video?videoId=${videoId}`);
        const data = await res.json() as { status: string; videoUrl?: string; error?: string };
        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          setVideoStep('done');
          setVideoUrl(data.videoUrl ?? null);
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setVideoStep('error');
          setVideoError(data.error ?? 'Videogenerering misslyckades.');
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoStep, videoId]);

  const handleSaveVideo = async () => {
    if (!videoUrl) return;
    setIsSaving(true);
    try {
      await kvSetSpeech({ script: speechScript, video_url: videoUrl, status: 'ready' });
      setSavedOk(true);
      onVideoSaved?.(videoUrl);
    } catch {
      setVideoError('Kunde inte spara video-URL till KV.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRes = RESOLUTIONS.find((r) => r.value === selectedResolution)!;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/30 p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-red-400">
          Generera fullständig video
        </span>
        <div className="flex-1 border-t border-zinc-800/80" />
      </div>

      <PortraitBadge portraitImageUrl={portraitImageUrl} sectionId={portraitSectionId} />

      {/* ── STEG 1: Röst ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-300">
            1
          </span>
          <span className="text-sm font-bold text-zinc-200">Generera röst</span>
          {audioStep === 'ready' && (
            <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Röst klar</span>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-400">Ljudkälla</label>
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1">
            <button
              type="button"
              onClick={() => {
                setAudioSource('tts');
                setAudioUrl(null);
                setDurationSeconds(null);
                setUploadError(null);
                setAudioStep('idle');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                audioSource === 'tts' ? 'bg-red-500/20 text-red-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              AI-genererad röst
            </button>
            <button
              type="button"
              onClick={() => {
                setAudioSource('upload');
                setAudioUrl(null);
                setDurationSeconds(null);
                setUploadError(null);
                setAudioStep('idle');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                audioSource === 'upload' ? 'bg-red-500/20 text-red-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ladda upp eget ljud (hela talet)
            </button>
          </div>
        </div>

        {audioSource === 'tts' && (
          <div className="space-y-3">
            <div className="space-y-1.5 sm:w-52">
              <label className="block text-xs font-semibold text-zinc-400">Röst</label>
              <VoiceSelect value={voiceName} onChange={setVoiceName} accent="red" />
            </div>
            {audioStep === 'idle' && (
              <button
                onClick={handleGenerateAudio}
                className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                Generera röst för hela talet
              </button>
            )}
            {audioStep === 'generating' && (
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <Spinner className="h-4 w-4" />
                <span>Genererar röst… (kan ta 30–60 s)</span>
              </div>
            )}
            {audioError && <ErrorAlert message={audioError} />}
          </div>
        )}

        {audioSource === 'upload' && audioStep === 'idle' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">
                Ladda upp ljudfil (WAV, MP3, M4A eller OGG — max 20 MB)
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 file:cursor-pointer"
              />
            </div>
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          </div>
        )}

        {audioStep === 'ready' && audioUrl && (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-300 font-medium">
                Röst klar
                {durationSeconds !== null && (
                  <> — <span className="text-amber-400">{durationSeconds} sekunder</span></>
                )}
              </p>
              <button
                onClick={() => {
                  setAudioStep('idle');
                  setAudioUrl(null);
                  setDurationSeconds(null);
                  setAudioError(null);
                  setUploadError(null);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg px-3 py-1.5 transition hover:bg-zinc-800"
              >
                Prova igen
              </button>
            </div>
            <audio src={audioUrl} controls className="w-full h-8" />
          </div>
        )}
      </div>

      {/* ── STEG 2: Video ────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 space-y-4 transition ${
          audioStep !== 'ready'
            ? 'border-zinc-800/50 bg-zinc-900/20 opacity-50 pointer-events-none select-none'
            : 'border-zinc-800 bg-zinc-900/40'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-300">
            2
          </span>
          <span className="text-sm font-bold text-zinc-200">Generera video</span>
          {audioStep !== 'ready' && (
            <span className="ml-2 text-xs text-zinc-600">Kräver färdig röst från Steg 1</span>
          )}
          {videoStep === 'done' && !audioStale && (
            <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Video klar</span>
          )}
        </div>

        {audioStale && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            Ljudet har ändrats — generera video på nytt för att matcha det nya ljudet.
          </div>
        )}

        {(videoStep === 'idle' || videoStep === 'confirming') && audioStep === 'ready' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-400">Välj upplösning</label>
              <p className="text-xs text-zinc-500">
                Upplösningen påverkar bara bildkvaliteten, inte priset ($0.0385/s).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RESOLUTIONS.map((res) => {
                  const isSelected = selectedResolution === res.value;
                  return (
                    <button
                      key={res.value}
                      type="button"
                      onClick={() => setSelectedResolution(res.value)}
                      disabled={videoStep === 'confirming'}
                      className={`rounded-xl border p-4 text-left transition space-y-1 ${
                        isSelected
                          ? 'border-red-500/50 bg-red-500/10 ring-1 ring-red-500/30'
                          : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-sm font-semibold text-zinc-200">{res.label}</span>
                      <p className="text-xs text-zinc-500">{res.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {durationSeconds !== null && (
              <p className="text-xs text-zinc-400">
                Beräknad kostnad:{' '}
                <span className="font-bold text-amber-400">{computeCost(durationSeconds)}</span>
                <span className="text-zinc-600 ml-1">(HeyGen $0.0385/s)</span>
              </p>
            )}

            {videoStep === 'idle' && (
              <button
                onClick={() => setVideoStep('confirming')}
                disabled={!portraitImageUrl}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generera video i {selectedRes.label}
                {durationSeconds !== null ? ` för ${computeCost(durationSeconds)}` : ''} →
              </button>
            )}

            {videoStep === 'confirming' && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-300">
                  Generera video i <strong>{selectedRes.label}</strong>
                  {durationSeconds !== null && (
                    <> för <strong className="text-amber-400">{computeCost(durationSeconds)}</strong>?</>
                  )}{' '}
                  Faktureras mot ditt HeyGen-konto ($0.0385/s).
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitVideo}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500 transition"
                  >
                    Bekräfta — starta generering
                  </button>
                  <button
                    onClick={() => setVideoStep('idle')}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {videoStep === 'submitting' && (
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Spinner className="h-4 w-4" />
            <span>Laddar upp och skickar in videojobb till HeyGen…</span>
          </div>
        )}

        {videoStep === 'polling' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <Spinner className="h-4 w-4" />
              <span>Genererar video… ({pollElapsed}s förfluten tid)</span>
            </div>
            <p className="text-xs text-zinc-600">
              Lång video kan ta 3–10 minuter. Stäng inte flikens fönster.
            </p>
          </div>
        )}

        {videoStep === 'done' && videoUrl && (
          <div className="space-y-4">
            {audioStale && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
                OBS: Videon genererades med ett tidigare ljud. Generera om med det nuvarande om det behövs.
              </div>
            )}
            <video
              src={videoUrl}
              controls
              className="w-full max-w-xl rounded-xl border border-zinc-800 bg-black"
              playsInline
            />
            <div className="flex flex-wrap gap-3">
              {!savedOk ? (
                <button
                  onClick={handleSaveVideo}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <><Spinner className="h-4 w-4" /><span>Sparar…</span></>
                  ) : (
                    <span>Spara som slutgiltig video</span>
                  )}
                </button>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 font-semibold">
                  ✓ Video sparad som slutgiltig — status satt till &quot;ready&quot;
                </div>
              )}
              <button
                onClick={() => {
                  setVideoStep('idle');
                  setVideoUrl(null);
                  setVideoId(null);
                  setSavedOk(false);
                  setVideoAudioUrl(null);
                }}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
              >
                Generera ny video
              </button>
            </div>
          </div>
        )}

        {videoStep === 'error' && videoError && (
          <div className="space-y-3">
            <ErrorAlert message={videoError} />
            <button
              onClick={() => {
                setVideoStep('idle');
                setVideoError(null);
                setVideoId(null);
                setVideoUrl(null);
              }}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
            >
              Börja om
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main admin page
// ---------------------------------------------------------------------------

const PORTRAIT_SECTION_ID = 'portrait-section';

export default function AdminPage() {
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const [toneInstructions, setToneInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [savedSpeechScript, setSavedSpeechScript] = useState<string>('');
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [saveScriptSuccess, setSaveScriptSuccess] = useState(false);
  const [saveScriptError, setSaveScriptError] = useState<string | null>(null);

  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [portraitImageUrl, setPortraitImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/participant-count');
        const data = await res.json() as { count?: number; error?: string };
        if (res.ok && typeof data.count === 'number') {
          setParticipantCount(data.count);
        } else {
          setCountError(data.error ?? 'Kunde inte hämta deltagarantal.');
        }
      } catch {
        setCountError('Kunde inte nå /api/participant-count.');
      }

      try {
        const res = await fetch('/api/current-persona');
        const data = await res.json() as {
          persona: { name: string; description: string; portrait_url: string } | null;
          speech: { script: string; video_url: string | null; status: string } | null;
          error?: string;
        };
        if (res.ok && data.persona && data.speech) {
          const savedPortrait = data.persona.portrait_url?.trim() || null;
          setResult({
            personaName: data.persona.name,
            personaDescription: data.persona.description,
            portraitPrompt: (data.persona as unknown as { portrait_prompt?: string }).portrait_prompt ?? '',
            speechScript: data.speech.script,
          });
          setSavedSpeechScript(data.speech.script);
          if (savedPortrait) setPortraitImageUrl(savedPortrait);
        }
      } catch {
        // No saved data
      } finally {
        setIsLoadingExisting(false);
      }
    }
    loadData();
  }, []);

  const handlePortraitChange = (url: string) => {
    setPortraitImageUrl(url);
    fetch('/api/save-portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: url }),
    }).catch((err) => console.error('Kunde inte spara porträtt till KV:', err));
  };

  const handleGenerateClick = () => {
    if (result) setShowConfirm(true);
    else runGeneration();
  };

  const runGeneration = async () => {
    setShowConfirm(false);
    setIsGenerating(true);
    setGenerateError(null);
    setSaveScriptSuccess(false);
    setSaveScriptError(null);

    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useTestData: false, toneInstructions }),
      });
      const data = await res.json() as Partial<GenerationResult> & Partial<ApiError>;
      if (!res.ok || data.error) {
        setGenerateError(data.error ?? 'Okänt fel vid generering.');
      } else {
        setResult({
          personaName: data.personaName!,
          personaDescription: data.personaDescription!,
          portraitPrompt: data.portraitPrompt!,
          speechScript: data.speechScript!,
        });
        setSavedSpeechScript(data.speechScript!);
        setPortraitImageUrl(null);
      }
    } catch {
      setGenerateError('Kunde inte nå /api/generate-text. Kontrollera att servern körs.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSpeechScript = async () => {
    if (!result || isSavingScript) return;
    setIsSavingScript(true);
    setSaveScriptError(null);
    setSaveScriptSuccess(false);
    try {
      const res = await fetch('/api/save-speech-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: result.speechScript }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        setSaveScriptError(data.error ?? 'Kunde inte spara talskriptet.');
      } else {
        setSavedSpeechScript(result.speechScript);
        setSaveScriptSuccess(true);
      }
    } catch {
      setSaveScriptError('Kunde inte nå /api/save-speech-script.');
    } finally {
      setIsSavingScript(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-400">
              Skarpt läge
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Adminmiljö</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Generera persona och tal baserat på riktiga deltagarsvar. Resultaten sparas och skriver över tidigare version.
          </p>
        </div>

        {/* Participant count */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              {participantCount === null && !countError ? (
                <div className="h-5 w-48 animate-pulse rounded-md bg-zinc-800" />
              ) : countError ? (
                <p className="text-sm text-red-400">{countError}</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-white">{participantCount} deltagare</p>
                  <p className="text-xs text-zinc-500">har svarat på enkäten och finns i KV</p>
                </>
              )}
            </div>
          </div>
          {participantCount === 0 && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              Inga svar hittade i participants:ids. Deltagare som svarat <em>innan</em> den senaste uppdateringen
              av deltagarappen finns inte i listan.
            </p>
          )}
        </div>

        {/* Generation controls */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            Generera persona &amp; tal
          </h2>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-400">
              Ton-instruktion{' '}
              <span className="font-normal text-zinc-600">(valfritt — styr Geminis stilval)</span>
            </label>
            <textarea
              rows={3}
              value={toneInstructions}
              onChange={(e) => setToneInstructions(e.target.value)}
              placeholder={'T.ex. "Håll det lite mer ironiskt och självkritiskt" eller "Betona det positiva och framtidstron"'}
              className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          {showConfirm && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-300">
                ⚠️ Är du säker? Detta skriver över nuvarande sparade persona och tal.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={runGeneration}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 transition"
                >
                  Ja, generera och skriv över
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {!showConfirm && (
            <button
              onClick={handleGenerateClick}
              disabled={isGenerating || (participantCount !== null && participantCount === 0)}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>Genererar… (kan ta 30–60 sekunder)</span>
                </>
              ) : (
                <span>Generera persona &amp; tal (skarpt läge)</span>
              )}
            </button>
          )}

          {generateError && <ErrorAlert message={generateError} />}
        </div>

        {isLoadingExisting && !result && (
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <Spinner className="h-4 w-4" />
            <span>Laddar sparad persona…</span>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            {/* Persona header + script */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="mb-1 inline-block rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                    Persona
                  </div>
                  <h2 className="text-2xl font-bold text-white">{result.personaName}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{result.personaDescription}</p>
                </div>
              </div>

              {/* Editable speech script */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Talskript</span>
                  <div className="flex-1 border-t border-zinc-800/60" />
                </div>
                <p className="text-xs text-zinc-400">
                  Ändringar här påverkar rösten/videon du genererar härnäst.
                </p>
                <textarea
                  rows={18}
                  value={result.speechScript}
                  onChange={(e) => {
                    const newScript = e.target.value;
                    setResult((prev) => (prev ? { ...prev, speechScript: newScript } : null));
                    setSaveScriptSuccess(false);
                    setSaveScriptError(null);
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 font-sans text-sm text-zinc-200 leading-relaxed placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  placeholder="Skriv eller redigera talskriptet här..."
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveSpeechScript}
                    disabled={isSavingScript || result.speechScript === savedSpeechScript}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSavingScript ? (
                      <>
                        <Spinner className="h-3.5 w-3.5 text-zinc-950" />
                        <span>Sparar…</span>
                      </>
                    ) : (
                      <span>Spara ändringar</span>
                    )}
                  </button>
                  {result.speechScript !== savedSpeechScript && (
                    <span className="text-xs text-amber-400/80">Osparade ändringar</span>
                  )}
                  {saveScriptSuccess && (
                    <span className="text-xs text-emerald-400">✓ Ändringar sparade</span>
                  )}
                  {saveScriptError && (
                    <span className="text-xs text-red-400">{saveScriptError}</span>
                  )}
                </div>
              </div>

              {/* Portrait prompt */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-500">Portrattprompt</span>
                <p className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400 italic">
                  {result.portraitPrompt}
                </p>
              </div>
            </div>

            {/* Portrait Section — shared top-level */}
            <div className="border-t border-zinc-800 p-5 sm:p-6">
              <PortraitSection
                portraitPrompt={result.portraitPrompt}
                portraitImageUrl={portraitImageUrl}
                onPortraitChange={handlePortraitChange}
                sectionId={PORTRAIT_SECTION_ID}
              />
            </div>

            {/* Snippet preview */}
            <SnippetTestSection
              result={result}
              portraitImageUrl={portraitImageUrl}
              portraitSectionId={PORTRAIT_SECTION_ID}
            />

            {/* Full video */}
            <FullVideoSection
              speechScript={result.speechScript}
              portraitImageUrl={portraitImageUrl}
              portraitSectionId={PORTRAIT_SECTION_ID}
            />
          </div>
        )}

        {!isLoadingExisting && !result && !isGenerating && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
            <p className="text-sm text-zinc-500">
              Ingen persona är sparad ännu. Generera en ovan för att komma igång.
            </p>
          </div>
        )}

        <DangerZone
          onResetComplete={(summary) => {
            setParticipantCount(
              summary.participantsDeleted > 0 || summary.qaEntriesDeleted > 0 ? 0 : 0
            );
            setResult(null);
            setSavedSpeechScript('');
            setPortraitImageUrl(null);
            fetch('/api/participant-count')
              .then((r) => r.json())
              .then((d: { count?: number }) => {
                if (typeof d.count === 'number') setParticipantCount(d.count);
              })
              .catch(() => {});
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger Zone component
// ---------------------------------------------------------------------------

interface ResetSummary {
  participantsDeleted: number;
  qaEntriesDeleted: number;
}

function DangerZone({ onResetComplete }: { onResetComplete: (summary: ResetSummary) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<ResetSummary | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const CONFIRM_WORD = 'NOLLSTÄLL';
  const canConfirm = confirmText === CONFIRM_WORD;

  const handleReset = async () => {
    if (!canConfirm) return;
    setIsResetting(true);
    setResetError(null);
    setResetResult(null);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json() as {
        ok: boolean;
        participantsDeleted?: number;
        qaEntriesDeleted?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setResetError(data.error ?? 'Nollställning misslyckades.');
      } else {
        const summary: ResetSummary = {
          participantsDeleted: data.participantsDeleted ?? 0,
          qaEntriesDeleted: data.qaEntriesDeleted ?? 0,
        };
        setResetResult(summary);
        setConfirmText('');
        onResetComplete(summary);
      }
    } catch {
      setResetError('Kunde inte nå /api/admin/reset. Kontrollera att servern körs.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mt-12 rounded-2xl border border-red-900/40 bg-red-950/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-sm font-semibold text-red-400">Farliga inställningar</span>
        </div>
        <span
          className="text-xs text-red-700 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="border-t border-red-900/30 p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-red-300">Nollställ allt</h3>
            <p className="mt-1 text-xs text-red-700/80">
              Raderar alla deltagarsvar, QA-poster, persona och tal från KV. Åtgärden kan inte ångras.
              Använd detta för att rensa testdata innan det riktiga evenemanget.
            </p>
          </div>

          {resetResult ? (
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/30 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-emerald-400">✓ Nollställning klar</p>
              <p className="text-xs text-emerald-600">
                {resetResult.participantsDeleted} deltagare och {resetResult.qaEntriesDeleted} Q&amp;A-poster raderades.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-red-400">
                  Skriv{' '}
                  <span className="font-mono bg-red-900/30 px-1.5 py-0.5 rounded text-red-300">
                    {CONFIRM_WORD}
                  </span>{' '}
                  för att bekräfta
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  className="w-full max-w-xs rounded-xl border border-red-900/40 bg-zinc-950 px-4 py-2.5 font-mono text-sm text-red-200 placeholder-red-900 transition focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
                />
              </div>

              {resetError && <ErrorAlert message={resetError} />}

              <button
                onClick={handleReset}
                disabled={!canConfirm || isResetting}
                className="flex items-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isResetting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    <span>Nollställer…</span>
                  </>
                ) : (
                  <span>Bekräfta nollställning</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
