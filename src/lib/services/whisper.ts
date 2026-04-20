/// <reference types="vite/client" />
// Whisper transcription service — calls OpenAI Whisper API
// SDS 04-03 §6 Voice Transcription Pipeline

import { buildWhisperPrompt, type PersonalVocabEntry } from './whisper-prompt';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export interface WhisperResult {
  text: string;
  error?: string;
}

export interface TranscribeOptions {
  /** Specimen description used to bias Whisper toward subspecialty terms. */
  specimenType?: string | null;
  /**
   * Optional user-curated terms (personal dictionary) added to the prompt.
   * Accepts structured {term, organKey} entries for per-organ filtering, or
   * plain strings (coerced to cross-organ entries).
   */
  personalTerms?: ReadonlyArray<PersonalVocabEntry | string>;
}

/**
 * Returns true if an OpenAI API key is configured.
 */
export function isWhisperAvailable(): boolean {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  return !!key && key !== 'sk-your-key-here' && !key.startsWith('sk-placeholder');
}

/**
 * Transcribe an audio blob using OpenAI Whisper.
 * Falls back to a simulated response if no API key is configured.
 */
export async function transcribe(
  audioBlob: Blob,
  options: TranscribeOptions = {},
): Promise<WhisperResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-your-key-here' || apiKey.startsWith('sk-placeholder')) {
    return {
      text: '',
      error: 'OpenAI API key not configured. Add VITE_OPENAI_API_KEY to your .env file.',
    };
  }

  if (audioBlob.size < 100) {
    return { text: '', error: 'Recording too short' };
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'speech.webm');
  formData.append('model', 'whisper-1');

  // Soft-bias Whisper toward pathology vocabulary. The prompt is memoized
  // by (organKey, personalFingerprint) so it's built once per case context.
  const prompt = buildWhisperPrompt(options.specimenType ?? null, options.personalTerms);
  if (prompt) {
    formData.append('prompt', prompt);
  }

  try {
    const response = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as any)?.error?.message || `Whisper API error (${response.status})`;
      return { text: '', error: message };
    }

    const data = await response.json();
    return { text: data.text ?? '' };
  } catch (e) {
    return { text: '', error: 'Network error during transcription' };
  }
}
