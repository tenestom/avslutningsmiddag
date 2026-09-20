'use client';

import { useState } from 'react';
import { submitParticipantAnswers } from './actions';

interface QuestionDef {
  number: number;
  text: string;
  placeholder: string;
}

const QUESTIONS: QuestionDef[] = [
  {
    number: 1,
    text: 'Vad var det roligaste eller mest minnesvärda som hände under kursen?',
    placeholder:
      'T.ex. När vi genomförde krisövningen sent på torsdagskvällen och strömmen faktiskt gick på riktigt – stämningen och kreativiteten i rummet var helt oslagbar!',
  },
  {
    number: 2,
    text: 'Beskriv det största hotet mot vår säkerhet.',
    placeholder:
      'T.ex. Naiviteten kring hur sårbara våra digitala och fysiska leveranskedjor faktiskt är vid en utdragen kris eller cyberattack mot kritisk infrastruktur.',
  },
  {
    number: 3,
    text: 'Om du fick bestämma en enda sak Sverige ska satsa på för att stärka totalförsvaret, vad skulle det vara?',
    placeholder:
      'T.ex. Att säkra lokal livsmedels- och energiförsörjning samt bygga upp robusta civila beredskapslager i varje kommun över hela landet.',
  },
  {
    number: 4,
    text: 'Vad tycker du är viktigast att göra redan imorgon, innan något annat?',
    placeholder:
      'T.ex. Att sätta mig ner med mina kollegor och gå igenom våra faktiska kontaktvägar och alternativa rutiner om internet och telefonin slås ut.',
  },
  {
    number: 5,
    text: 'Vad vill du tacka kursen/arrangören för?',
    placeholder:
      'T.ex. För engagerade föreläsare, tuffa och lärorika diskussioner och framför allt gemenskapen och alla nya vänner i gruppen.',
  },
];

export default function ParticipantFormPage() {
  const [answers, setAnswers] = useState<Record<number, string>>({
    1: '',
    2: '',
    3: '',
    4: '',
    5: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleAnswerChange = (questionNumber: number, val: string) => {
    setAnswers((prev) => ({ ...prev, [questionNumber]: val }));
    if (errors[`question_${questionNumber}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`question_${questionNumber}`];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    QUESTIONS.forEach((q) => {
      const ans = (answers[q.number] || '').trim();
      if (!ans) {
        newErrors[`question_${q.number}`] = 'Vänligen svara på frågan.';
      } else if (ans.length < 15) {
        newErrors[
          `question_${q.number}`
        ] = `Svaret är lite för kort (minst 15 tecken, nu ${ans.length}).`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      // Scroll to the first error
      const firstErrorField = document.querySelector('[aria-invalid="true"]');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        answers: QUESTIONS.map((q) => ({
          question_number: q.number,
          question_text: q.text,
          answer_text: (answers[q.number] || '').trim(),
        })),
      };

      const result = await submitParticipantAnswers(payload);

      if (result.success) {
        setIsSubmitted(true);
      } else {
        setServerError(
          result.error ||
            'Ett fel uppstod när svaren skulle sparas. Vänligen försök igen.'
        );
      }
    } catch {
      setServerError(
        'Kunde inte nå servern. Kontrollera din internetanslutning och försök igen.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-8">
        <main className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur text-center animate-fade-in">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Tack för dina svar!
          </h1>
          <p className="mt-3 text-base text-zinc-300">
            Dina svar är sparade.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Vi ses på avslutningsmiddagen!
          </p>
        </main>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1 text-xs font-medium text-zinc-400 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Kursavslutning
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Avslutningsmiddag
          </h1>
          <p className="mt-2 text-sm sm:text-base text-zinc-400 leading-relaxed">
            Dela dina upplevelser och tankar från kursen.
          </p>
        </header>

        {/* Form Container */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8 shadow-xl backdrop-blur">
          {serverError && (
            <div
              className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5"
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
                <span>{serverError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-7">
            {/* Questions */}
            <div className="space-y-8">
              {QUESTIONS.map((q) => {
                const errorKey = `question_${q.number}`;
                const hasError = !!errors[errorKey];
                const value = answers[q.number] || '';

                return (
                  <div key={q.number} className="space-y-2.5">
                    <label
                      htmlFor={`question-${q.number}`}
                      className="block text-sm sm:text-base font-semibold leading-snug text-zinc-200"
                    >
                      <span className="text-zinc-500 mr-1.5">{q.number}.</span>
                      {q.text} <span className="text-emerald-400">*</span>
                    </label>

                    <textarea
                      id={`question-${q.number}`}
                      rows={4}
                      value={value}
                      onChange={(e) =>
                        handleAnswerChange(q.number, e.target.value)
                      }
                      placeholder={q.placeholder}
                      aria-invalid={hasError ? 'true' : 'false'}
                      aria-describedby={hasError ? `question-${q.number}-error` : undefined}
                      className={`w-full resize-y rounded-xl border bg-zinc-950/80 p-4 text-base text-white placeholder-zinc-500 transition focus:outline-none focus:ring-2 ${
                        hasError
                          ? 'border-red-500/60 focus:ring-red-500/40'
                          : 'border-zinc-800 focus:border-zinc-700 focus:ring-emerald-500/30'
                      }`}
                    />

                    {hasError && (
                      <p
                        id={`question-${q.number}-error`}
                        className="text-xs sm:text-sm font-medium text-red-400"
                      >
                        {errors[errorKey]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Helper text */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 text-center">
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                💡 <span className="text-zinc-300 font-medium">Tips:</span> Skriv gärna 1–3 meningar per fråga!
              </p>
            </div>


            {/* Submit button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-zinc-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin text-zinc-950"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Skickar...</span>
                  </>
                ) : (
                  <span>Skicka in svar</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
