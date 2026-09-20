'use client';

import { useState, useEffect } from 'react';
import type { Speech } from '@shared';
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
// Utility helpers (same as /test)
// ---------------------------------------------------------------------------

function getFirstTwoSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?\u2026]+/g) ?? [];
  const snippet = sentences.slice(0, 2).join(' ').trim();
  return snippet || text.slice(0, 300).trim();
}

function estimateCost(text: string): string {
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
// Avatar test section (same pattern as /test, but tied to one result)
// ---------------------------------------------------------------------------

type VideoStep = 'audio' | 'submit' | 'polling' | null;
type AudioSource = 'tts' | 'upload';
type PortraitSource = 'ai' | 'upload';

interface AvatarState {
  snippetText: string;
  voiceName: string;
  audioSource: AudioSource;
  audioUrl: string | null;
  audioError: string | null;
  portraitSource: PortraitSource;
  isGeneratingPortrait: boolean;
  portraitError: string | null;
  portraitImageUrl: string | null;
  videoStep: VideoStep;
  videoId: string | null;
  videoPollElapsed: number;
  videoError: string | null;
  videoUrl: string | null;
}

function AvatarTestSection({
  result,
  onPortraitGenerated,
}: {
  result: GenerationResult;
  onPortraitGenerated?: (imageUrl: string) => void;
}) {
  const [state, setState] = useState<AvatarState>({
    snippetText: getFirstTwoSentences(result.speechScript),
    voiceName: 'Kore',
    audioSource: 'tts',
    audioUrl: null,
    audioError: null,
    portraitSource: 'ai',
    isGeneratingPortrait: false,
    portraitError: null,
    portraitImageUrl: null,
    videoStep: null,
    videoId: null,
    videoPollElapsed: 0,
    videoError: null,
    videoUrl: null,
  });

  const patch = (updates: Partial<AvatarState>) =>
    setState((prev) => ({ ...prev, ...updates }));

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    patch({ audioError: null });
    if (file.size > 15 * 1024 * 1024) {
      patch({
        audioError: `Filen är för stor (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximal filstorlek är 15 MB.`,
      });
      return;
    }
    const validExtensions = ['.wav', '.mp3', '.m4a', '.ogg'];
    const validMimes = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'application/ogg'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt && !validMimes.includes(file.type)) {
      patch({ audioError: 'Ogiltigt filformat. Endast WAV, MP3, M4A och OGG accepteras.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') patch({ audioUrl: reader.result, audioError: null });
    };
    reader.onerror = () => patch({ audioError: 'Ett fel uppstod vid inläsning av ljudfilen.' });
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    patch({ portraitError: null });

    // Validate size: max 10MB
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      patch({
        portraitError: `Bilden är för stor (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximal filstorlek är 10 MB.`,
      });
      return;
    }

    // Validate type: jpeg/png/webp only
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!hasValidExt || !validMimes.includes(file.type)) {
      patch({
        portraitError: 'Ogiltigt filformat. Endast JPEG, PNG och WebP accepteras.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        patch({ portraitImageUrl: dataUrl, portraitError: null });
        onPortraitGenerated?.(dataUrl);
      }
    };
    reader.onerror = () => {
      patch({ portraitError: 'Ett fel uppstod vid inläsning av bilden.' });
    };
    reader.readAsDataURL(file);
  };


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
        const imageUrl = data.imageUrl ?? null;
        patch({ portraitImageUrl: imageUrl });
        if (imageUrl) onPortraitGenerated?.(imageUrl);
      }
    } catch {
      patch({ portraitError: 'Kunde inte nå /api/generate-portrait.' });
    } finally {
      patch({ isGeneratingPortrait: false });
    }
  };

  const handleGenerateVideo = async () => {
    if (!state.portraitImageUrl) return;
    let targetAudioUrl = state.audioUrl;

    if (state.audioSource === 'tts') {
      patch({ videoStep: 'audio', videoError: null, videoUrl: null, videoId: null, videoPollElapsed: 0 });
      try {
        const audioRes = await fetch('/api/generate-audio-snippet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: state.snippetText, voiceName: state.voiceName }),
        });
        const audioData = (await audioRes.json()) as { audioUrl?: string } & Partial<ApiError>;
        if (!audioRes.ok || audioData.error) {
          patch({ videoStep: null, videoError: audioData.error ?? 'Okänt fel vid röstsyntes.' });
          return;
        }
        targetAudioUrl = audioData.audioUrl!;
        patch({ audioUrl: targetAudioUrl });
      } catch {
        patch({ videoStep: null, videoError: 'Kunde inte nå /api/generate-audio-snippet.' });
        return;
      }
    } else {
      if (!targetAudioUrl) {
        patch({ videoError: 'Vänligen ladda upp en ljudfil först.' });
        return;
      }
    }

    // Submit video job (async — returns videoId immediately)
    patch({ videoStep: 'submit', videoError: null, videoUrl: null, videoId: null, videoPollElapsed: 0 });
    try {
      const videoRes = await fetch('/api/generate-video-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: state.portraitImageUrl, audioUrl: targetAudioUrl }),
      });
      const videoData = (await videoRes.json()) as { videoId?: string; error?: string };
      if (!videoRes.ok || videoData.error) {
        patch({ videoStep: null, videoError: videoData.error ?? 'Okänt fel vid videoinlämning.' });
        return;
      }
      // Start polling
      patch({ videoStep: 'polling', videoId: videoData.videoId ?? null, videoPollElapsed: 0 });
    } catch {
      patch({ videoStep: null, videoError: 'Kunde inte nå /api/generate-video-snippet.' });
    }
  };

  // Poll video job status every 3 seconds while in 'polling' step
  useEffect(() => {
    if (state.videoStep !== 'polling' || !state.videoId) return;

    const startTime = Date.now();
    const interval = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setState((prev) => ({ ...prev, videoPollElapsed: elapsed }));

      try {
        const res = await fetch(`/api/generate-video-snippet?videoId=${state.videoId}`);
        const data = (await res.json()) as { status: string; videoUrl?: string; error?: string };

        if (data.status === 'COMPLETED') {
          clearInterval(interval);
          setState((prev) => ({ ...prev, videoStep: null, videoUrl: data.videoUrl ?? null }));
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setState((prev) => ({
            ...prev,
            videoStep: null,
            videoError: data.error ?? 'Videogenerering misslyckades.',
          }));
        }
        // IN_PROGRESS: keep polling
      } catch {
        // Network hiccup — keep trying
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.videoStep, state.videoId]);

  const isGeneratingVideo = state.videoStep !== null;
  const videoStepLabel =
    state.videoStep === 'audio'
      ? 'Genererar röst…'
      : state.videoStep === 'submit'
      ? 'Skickar in videojobb…'
      : state.videoStep === 'polling'
      ? `Genererar video… (${state.videoPollElapsed}s)`
      : null;

  return (

    <div className="border-t border-zinc-800 bg-zinc-950/30 p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
          Förhandsgranska avatar (kort klipp)
        </span>
        <div className="flex-1 border-t border-zinc-800/80" />
      </div>

      {/* Audio mode toggle */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-zinc-400">Ljudkälla</label>
        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1">
          <button
            type="button"
            onClick={() => patch({ audioSource: 'tts', audioError: null })}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              state.audioSource === 'tts'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI-genererad röst
          </button>
          <button
            type="button"
            onClick={() => patch({ audioSource: 'upload', audioError: null })}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              state.audioSource === 'upload'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Ladda upp eget ljud
          </button>
        </div>
      </div>

      {state.audioSource === 'tts' ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-400">
              Textutdrag att testa{' '}
              <span className="font-normal text-zinc-600">(redigera fritt)</span>
            </label>
            <textarea
              rows={3}
              value={state.snippetText}
              onChange={(e) => patch({ snippetText: e.target.value })}
              className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <div className="space-y-1.5 sm:w-52">
            <label className="block text-xs font-semibold text-zinc-400">Röst</label>
            <select
              value={state.voiceName}
              onChange={(e) => patch({ voiceName: e.target.value })}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-200 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="Kore">Kore (kvinna, bestämd)</option>
              <option value="Puck">Puck (man, pigg)</option>
              <option value="Charon">Charon (man, informativ)</option>
              <option value="Aoede">Aoede (kvinna, lätt)</option>
              <option value="Orus">Orus (man, bestämd)</option>
              <option value="Leda">Leda (kvinna, ungdomlig)</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-300">Ladda upp eget ljud</label>
            <p className="text-xs text-zinc-500">Stöder WAV, MP3, M4A, OGG (max 15 MB).</p>
          </div>
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg"
            onChange={handleAudioUpload}
            className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-zinc-950 hover:file:bg-amber-400 file:cursor-pointer cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/80 p-2"
          />
          {state.audioError && <ErrorAlert message={state.audioError} />}
          {state.audioUrl && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3">
              <span className="text-xs font-medium text-zinc-300">Förhandslyssning:</span>
              <audio src={state.audioUrl} controls className="w-full h-8" />
            </div>
          )}
        </div>
      )}

      {/* Step 1: Portrait */}
      <div className="space-y-3">
        {/* Portrait source toggle */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-400">Porträttkälla</label>
          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1">
            <button
              type="button"
              onClick={() => patch({ portraitSource: 'ai', portraitError: null })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                state.portraitSource === 'ai'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              AI-genererat porträtt
            </button>
            <button
              type="button"
              onClick={() => patch({ portraitSource: 'upload', portraitError: null })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                state.portraitSource === 'upload'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ladda upp egen bild
            </button>
          </div>
        </div>

        {state.portraitSource === 'ai' ? (
          <div>
            <button
              onClick={handleGeneratePortrait}
              disabled={state.isGeneratingPortrait}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        ) : (
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

      {/* Step 2: Video */}
      {state.portraitImageUrl && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateVideo}
              disabled={
                isGeneratingVideo ||
                (state.audioSource === 'tts' ? !state.snippetText.trim() : !state.audioUrl)
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingVideo ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>{videoStepLabel}</span>
                </>
              ) : state.audioSource === 'upload' ? (
                <span>Generera video (med uppladdat ljud)</span>
              ) : (
                <span>Generera röst + video (kort test)</span>
              )}
            </button>
            <span className="text-xs text-zinc-500">
              {state.audioSource === 'tts'
                ? `Kort test ≈ ${estimateCost(state.snippetText)}`
                : 'Kort test ≈ $0.10–$0.30'}
            </span>
          </div>
          {state.videoError && <ErrorAlert message={state.videoError} />}
          {state.videoUrl && (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <video src={state.videoUrl} controls className="w-full max-w-md rounded-xl" playsInline />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resolution picker + full-length video generation
// ---------------------------------------------------------------------------

// HeyGen Avatar IV Photo Avatar resolution tiers
// Pricing: flat $0.05 per second of output video, regardless of resolution.
const RESOLUTIONS = [
  {
    value: '720p',
    label: '720p HD',
    description: 'Snabbare rendering — bra för test och presentation',
  },
  {
    value: '1080p',
    label: '1080p Full HD',
    description: 'Skarp kvalitet — rekommenderas för slutresultat',
  },
  {
    value: '4k',
    label: '4K Ultra HD',
    description: 'Högsta bildkvalitet — tar något längre tid',
  },
] as const;

type ResolutionValue = (typeof RESOLUTIONS)[number]['value'];

// HeyGen: flat $0.05 per second, resolution only affects quality
function computeCost(durationSeconds: number): string {
  const cost = durationSeconds * 0.05;
  return `$${cost.toFixed(2)}`;
}


interface FullVideoSectionProps {
  speechScript: string;
  portraitImageUrl: string | null;
  onVideoSaved?: (videoUrl: string) => void;
}

type FullVideoStep =
  | 'idle'
  | 'generating_audio'
  | 'pick_resolution'
  | 'confirming'
  | 'submitting'
  | 'polling'
  | 'done'
  | 'error';

interface FullVideoState {
  step: FullVideoStep;
  error: string | null;
  audioSource: 'tts' | 'upload';
  uploadError: string | null;
  voiceName: string;
  audioUrl: string | null;
  durationSeconds: number | null;
  selectedResolution: ResolutionValue;
  videoId: string | null;
  videoUrl: string | null;
  pollElapsed: number;
  isSaving: boolean;
  savedOk: boolean;
}

function FullVideoSection({ speechScript, portraitImageUrl, onVideoSaved }: FullVideoSectionProps) {
  const [state, setState] = useState<FullVideoState>({
    step: 'idle',
    error: null,
    audioSource: 'tts',
    uploadError: null,
    voiceName: 'Kore',
    audioUrl: null,
    durationSeconds: null,
    selectedResolution: '1080p',
    videoId: null,
    videoUrl: null,
    pollElapsed: 0,
    isSaving: false,
    savedOk: false,
  });

  const patch = (updates: Partial<FullVideoState>) =>
    setState((prev) => ({ ...prev, ...updates }));

  // Polling interval ref — cleared on unmount
  const pollRef = { current: null as ReturnType<typeof setInterval> | null };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Handle custom audio file upload — reads duration via browser Audio API
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    patch({ uploadError: null, audioUrl: null, durationSeconds: null });

    // Validate size: 20 MB max
    if (file.size > 20 * 1024 * 1024) {
      patch({
        uploadError: `Filen är för stor (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximal filstorlek är 20 MB.`,
      });
      return;
    }

    // Validate type: wav, mp3, m4a, ogg
    const validExtensions = ['.wav', '.mp3', '.m4a', '.ogg'];
    const validMimes = [
      'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/mpeg', 'audio/mp3',
      'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
      'audio/ogg', 'application/ogg',
    ];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt && !validMimes.includes(file.type)) {
      patch({ uploadError: 'Ogiltigt filformat. Endast WAV, MP3, M4A och OGG accepteras.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Detect duration using the browser Audio API
      const audio = new Audio(dataUrl);
      audio.addEventListener('loadedmetadata', () => {
        const dur = isFinite(audio.duration) ? Math.round(audio.duration) : null;
        patch({ audioUrl: dataUrl, durationSeconds: dur, uploadError: null });
      });
      audio.addEventListener('error', () => {
        // Duration unknown — still allow the upload; cost estimate will be unavailable
        patch({ audioUrl: dataUrl, durationSeconds: null, uploadError: null });
      });
    };
    reader.onerror = () => {
      patch({ uploadError: 'Ett fel uppstod vid inläsning av ljudfilen.' });
    };
    reader.readAsDataURL(file);
  };

  // Step 1 (TTS path): Generate full audio via Gemini TTS
  const handleGenerateAudio = async () => {
    patch({ step: 'generating_audio', error: null });
    try {
      const res = await fetch('/api/generate-full-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: speechScript, voiceName: state.voiceName }),
      });
      const data = await res.json() as { audioUrl?: string; durationSeconds?: number; error?: string };
      if (!res.ok || data.error) {
        patch({ step: 'error', error: data.error ?? 'Okänt fel vid röstsyntes.' });
        return;
      }
      patch({ step: 'pick_resolution', audioUrl: data.audioUrl ?? null, durationSeconds: data.durationSeconds ?? null });
    } catch {
      patch({ step: 'error', error: 'Kunde inte nå /api/generate-full-audio.' });
    }
  };

  // Step 2 -> 3: Pick resolution → confirm
  const handlePickResolution = (value: ResolutionValue) => patch({ selectedResolution: value });
  const handleConfirm = () => patch({ step: 'confirming' });
  const handleCancelConfirm = () => patch({ step: 'pick_resolution' });

  // Step 3 -> 4: Submit video job
  const handleSubmitVideo = async () => {
    if (!state.audioUrl || !portraitImageUrl) return;
    patch({ step: 'submitting', error: null });

    try {
      const res = await fetch('/api/generate-full-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: portraitImageUrl,
          audioUrl: state.audioUrl,
          resolution: state.selectedResolution,
        }),
      });
      const data = await res.json() as { videoId?: string; error?: string };
      if (!res.ok || data.error) {
        patch({ step: 'error', error: data.error ?? 'Okänt fel vid videoinlämning.' });
        return;
      }
      patch({ step: 'polling', videoId: data.videoId ?? null, pollElapsed: 0 });
    } catch {
      patch({ step: 'error', error: 'Kunde inte nå /api/generate-full-video.' });
    }
  };

  // Step 4: Poll status every 5 seconds
  useEffect(() => {
    if (state.step !== 'polling' || !state.videoId) return;

    const startTime = Date.now();
    pollRef.current = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      setState((prev) => ({ ...prev, pollElapsed: elapsed }));

      try {
        const res = await fetch(`/api/generate-full-video?videoId=${state.videoId}`);
        const data = await res.json() as { status: string; videoUrl?: string; error?: string };

        if (data.status === 'COMPLETED') {
          stopPolling();
          setState((prev) => ({ ...prev, step: 'done', videoUrl: data.videoUrl ?? null }));
        } else if (data.status === 'FAILED') {
          stopPolling();
          setState((prev) => ({ ...prev, step: 'error', error: data.error ?? 'Videogenerering misslyckades.' }));
        }
        // IN_PROGRESS: continue polling
      } catch {
        // Network error during poll — keep trying
      }
    }, 5000);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.videoId]);

  // Step 5: Save final video to KV
  const handleSaveVideo = async () => {
    if (!state.videoUrl) return;
    patch({ isSaving: true });
    try {
      await kvSetSpeech({ script: speechScript, video_url: state.videoUrl, status: 'ready' });
      patch({ isSaving: false, savedOk: true });
      onVideoSaved?.(state.videoUrl);
    } catch {
      patch({ isSaving: false, error: 'Kunde inte spara video-URL till KV.' });
    }
  };

  const selectedRes = RESOLUTIONS.find((r) => r.value === state.selectedResolution)!;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/30 p-5 sm:p-6 space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-red-400">
          Generera fullständig video
        </span>
        <div className="flex-1 border-t border-zinc-800/80" />
      </div>

      {/* Idle step: audio source toggle + TTS or upload UI */}
      {state.step === 'idle' && (
        <div className="space-y-4">
          {/* Source toggle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-400">Ljudkälla</label>
            <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1">
              <button
                type="button"
                onClick={() => patch({ audioSource: 'tts', audioUrl: null, durationSeconds: null, uploadError: null })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  state.audioSource === 'tts'
                    ? 'bg-red-500/20 text-red-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                AI-genererad röst
              </button>
              <button
                type="button"
                onClick={() => patch({ audioSource: 'upload', audioUrl: null, durationSeconds: null, uploadError: null })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  state.audioSource === 'upload'
                    ? 'bg-red-500/20 text-red-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Ladda upp eget ljud (hela talet)
              </button>
            </div>
          </div>

          {/* TTS path: voice selector + generate button */}
          {state.audioSource === 'tts' && (
            <>
              <div className="space-y-1.5 sm:w-52">
                <label className="block text-xs font-semibold text-zinc-400">Röst</label>
                <select
                  value={state.voiceName}
                  onChange={(e) => patch({ voiceName: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-200 transition focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  <option value="Kore">Kore (kvinna, bestämd)</option>
                  <option value="Puck">Puck (man, pigg)</option>
                  <option value="Charon">Charon (man, informativ)</option>
                  <option value="Aoede">Aoede (kvinna, lätt)</option>
                  <option value="Orus">Orus (man, bestämd)</option>
                  <option value="Leda">Leda (kvinna, ungdomlig)</option>
                </select>
              </div>

              <button
                onClick={handleGenerateAudio}
                disabled={!portraitImageUrl}
                className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Generera röst för hela talet
              </button>
              {!portraitImageUrl && (
                <p className="text-xs text-zinc-500">
                  Generera ett porträtt i förhandsgranskningssektionen ovan innan du skapar fullständig video.
                </p>
              )}
            </>
          )}

          {/* Upload path: file input + preview + proceed button */}
          {state.audioSource === 'upload' && (
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

              {/* Validation error */}
              {state.uploadError && (
                <p className="text-xs text-red-400">{state.uploadError}</p>
              )}

              {/* Preview + duration once file is loaded */}
              {state.audioUrl && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
                  <p className="text-sm text-zinc-300 font-medium">
                    ✓ Ljud laddat
                    {state.durationSeconds !== null && (
                      <> — <span className="text-amber-400">{state.durationSeconds} sekunder</span></>
                    )}
                  </p>
                  <audio src={state.audioUrl} controls className="w-full h-8" />
                </div>
              )}

              {/* Proceed to resolution picker */}
              {state.audioUrl && (
                <button
                  onClick={() => patch({ step: 'pick_resolution' })}
                  disabled={!portraitImageUrl}
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Välj upplösning och generera video →
                </button>
              )}
              {!portraitImageUrl && (
                <p className="text-xs text-zinc-500">
                  Generera ett porträtt i förhandsgranskningssektionen ovan innan du skapar fullständig video.
                </p>
              )}
            </div>
          )}
        </div>
      )}


      {/* Generating audio */}
      {state.step === 'generating_audio' && (
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Spinner className="h-4 w-4" />
          <span>Genererar röst för hela talet… (kan ta 30–60 s)</span>
        </div>
      )}

      {/* Audio ready + resolution picker */}
      {(state.step === 'pick_resolution' || state.step === 'confirming') && state.durationSeconds !== null && (
        <div className="space-y-5">
          {/* Audio preview */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
            <p className="text-sm text-zinc-300 font-medium">
              ✓ Röst klar — <span className="text-amber-400">{state.durationSeconds} sekunder</span>
              {' · '}
              <span className="text-amber-400 font-bold">Beräknad kostnad: {computeCost(state.durationSeconds)}</span>
              <span className="text-zinc-500 text-xs ml-1">(HeyGen $0.05/s)</span>
            </p>
            {state.audioUrl && <audio src={state.audioUrl} controls className="w-full h-8" />}
          </div>

          {/* Resolution picker */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-400">Välj upplösning</label>
            <p className="text-xs text-zinc-500">Upplösningen påverkar bara bildkvaliteten, inte priset.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RESOLUTIONS.map((res) => {
                const isSelected = state.selectedResolution === res.value;
                return (
                  <button
                    key={res.value}
                    type="button"
                    onClick={() => handlePickResolution(res.value)}
                    disabled={state.step === 'confirming'}
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

          {/* Proceed to confirm */}
          {state.step === 'pick_resolution' && (
            <button
              onClick={handleConfirm}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Generera video i {selectedRes.label} för {computeCost(state.durationSeconds)} →
            </button>
          )}

          {/* Confirmation step */}
          {state.step === 'confirming' && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-300">
                Generera video i <strong>{selectedRes.label}</strong> för{' '}
                <strong className="text-amber-400">
                  {computeCost(state.durationSeconds)}
                </strong>?
                {' '}Videogenerering faktureras direkt mot ditt HeyGen-konto ($0.05/s).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitVideo}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500 transition"
                >
                  Bekräfta — starta generering
                </button>
                <button
                  onClick={handleCancelConfirm}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submitting job */}
      {state.step === 'submitting' && (
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Spinner className="h-4 w-4" />
          <span>Laddar upp och skickar in videojobb till HeyGen…</span>
        </div>
      )}


      {/* Polling */}
      {state.step === 'polling' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Spinner className="h-4 w-4" />
            <span>Genererar video… ({state.pollElapsed}s förfluten tid)</span>
          </div>
          <p className="text-xs text-zinc-600">
            Lång video kan ta 3–10 minuter. Stäng inte flikens fönster.
          </p>
        </div>
      )}

      {/* Done */}
      {state.step === 'done' && state.videoUrl && (
        <div className="space-y-4">
          <video
            src={state.videoUrl}
            controls
            className="w-full max-w-xl rounded-xl border border-zinc-800 bg-black"
            playsInline
          />
          {!state.savedOk ? (
            <button
              onClick={handleSaveVideo}
              disabled={state.isSaving}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 transition disabled:opacity-50"
            >
              {state.isSaving ? (
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
        </div>
      )}

      {/* Error */}
      {state.step === 'error' && state.error && (
        <div className="space-y-3">
          <ErrorAlert message={state.error} />
          <button
            onClick={() => patch({ step: 'idle', error: null, uploadError: null, audioUrl: null, durationSeconds: null, videoId: null, videoUrl: null })}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
          >
            Börja om
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main admin page
// ---------------------------------------------------------------------------

export default function AdminPage() {

  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const [toneInstructions, setToneInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  // Shared portrait URL — set by AvatarTestSection once a portrait is generated,
  // then passed into FullVideoSection so it doesn't need to regenerate it.
  const [sharedPortraitImageUrl, setSharedPortraitImageUrl] = useState<string | null>(null);


  // Load participant count and any existing persona/speech on mount
  useEffect(() => {
    async function loadData() {
      // Fetch participant count
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

      // Fetch existing persona/speech
      try {
        const res = await fetch('/api/current-persona');
        const data = await res.json() as { persona: { name: string; description: string; portrait_url: string } | null; speech: { script: string; video_url: string | null; status: string } | null; error?: string };
        if (res.ok && data.persona && data.speech) {
          setResult({
            personaName: data.persona.name,
            personaDescription: data.persona.description,
            portraitPrompt: data.persona.portrait_url || '',
            speechScript: data.speech.script,
          });
        }
      } catch {
        // No saved data — that's fine, just show blank state
      } finally {
        setIsLoadingExisting(false);
      }
    }

    loadData();
  }, []);

  const handleGenerateClick = () => {
    if (result) {
      setShowConfirm(true);
    } else {
      runGeneration();
    }
  };

  const runGeneration = async () => {
    setShowConfirm(false);
    setIsGenerating(true);
    setGenerateError(null);

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
      }
    } catch {
      setGenerateError('Kunde inte nå /api/generate-text. Kontrollera att servern körs.');
    } finally {
      setIsGenerating(false);
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
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Adminmiljö
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Generera persona och tal baserat på riktiga deltagarsvar. Resultaten sparas och skriver över tidigare version.
          </p>
        </div>

        {/* Participant count card */}
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
              Inga svar hittade i participants:ids. Observera att deltagare som svarat <em>innan</em> den senaste uppdateringen av deltagarappen inte finns i listan — de behöver svara på nytt eller backfillas manuellt.
            </p>
          )}
        </div>

        {/* Generation controls */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            Generera persona & tal
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

          {/* Overwrite confirmation */}
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

        {/* Result — existing or freshly generated */}
        {isLoadingExisting && !result && (
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <Spinner className="h-4 w-4" />
            <span>Laddar sparad persona…</span>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            {/* Persona header */}
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

              {/* Speech script */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Talskript</span>
                  <div className="flex-1 border-t border-zinc-800/60" />
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 max-h-80 overflow-y-auto">
                  {result.speechScript.split('\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="mb-3 text-sm text-zinc-300 leading-relaxed last:mb-0">
                      {para}
                    </p>
                  ))}
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

            {/* Avatar preview section */}
            <AvatarTestSection
              result={result}
              onPortraitGenerated={(url) => setSharedPortraitImageUrl(url)}
            />

            {/* Full-length video generation section */}
            <FullVideoSection
              speechScript={result.speechScript}
              portraitImageUrl={sharedPortraitImageUrl}
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

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <DangerZone
          onResetComplete={(summary) => {
            setParticipantCount(summary.participantsDeleted > 0 || summary.qaEntriesDeleted > 0 ? 0 : 0);
            setResult(null);
            setSharedPortraitImageUrl(null);
            // Refresh actual count from server
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
// Danger Zone component (separated so state is isolated)
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
      const data = await res.json() as { ok: boolean; participantsDeleted?: number; qaEntriesDeleted?: number; error?: string };

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
      {/* Toggle header */}
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
        <span className="text-xs text-red-700 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
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
                  Skriv <span className="font-mono bg-red-900/30 px-1.5 py-0.5 rounded text-red-300">{CONFIRM_WORD}</span> för att bekräfta
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
