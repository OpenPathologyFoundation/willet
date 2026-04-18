/**
 * Microphone Mock Utility for Playwright E2E Tests
 *
 * Intercepts navigator.mediaDevices.getUserMedia and MediaRecorder
 * to simulate voice recording with pre-recorded audio files.
 *
 * Usage in a test:
 *   await injectMicMock(page, '/fixtures/audio/diagnosis-dictation.webm');
 *   // ... click mic button, stop recording ...
 *   // The Whisper API will receive the pre-recorded audio instead of live mic input
 *
 * Audio file preparation:
 *   Record with Audacity at 16kHz mono, export as WebM/Opus or WAV.
 *   Place files in e2e/fixtures/audio/
 */

import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Inject the microphone mock into the page.
 * Must be called BEFORE any getUserMedia calls (i.e., before clicking the mic button).
 *
 * @param page — Playwright page object
 * @param audioFilePath — Path to the audio file (relative to e2e/fixtures/audio/ or absolute)
 * @param options — Optional configuration
 */
export async function injectMicMock(
  page: Page,
  audioFilePath: string,
  options: { autoStopAfterMs?: number } = {},
) {
  // Resolve the audio file path
  const resolvedPath = path.isAbsolute(audioFilePath)
    ? audioFilePath
    : path.join(__dirname, 'audio', audioFilePath);

  // Read the audio file as base64
  const audioBuffer = fs.readFileSync(resolvedPath);
  const audioBase64 = audioBuffer.toString('base64');
  const mimeType = audioFilePath.endsWith('.wav')
    ? 'audio/wav'
    : audioFilePath.endsWith('.opus')
      ? 'audio/ogg; codecs=opus'
      : 'audio/webm';

  // Inject the mock into the page context
  await page.evaluate(
    ({ audioBase64, mimeType, autoStopAfterMs }) => {
      // Convert base64 back to ArrayBuffer
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: mimeType });

      // Create a silent audio track for the fake stream
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const dest = audioContext.createMediaStreamDestination();
      oscillator.connect(dest);
      oscillator.start();
      const silentStream = dest.stream;

      // Store original getUserMedia
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      // Override getUserMedia to return our silent stream
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints && (constraints as MediaStreamConstraints).audio) {
          console.log('[mic-mock] getUserMedia intercepted — returning mock stream');
          return silentStream;
        }
        return originalGetUserMedia(constraints);
      };

      // Override MediaRecorder to deliver the pre-recorded audio blob
      const OriginalMediaRecorder = window.MediaRecorder;

      class MockMediaRecorder extends OriginalMediaRecorder {
        private _mockBlob: Blob;
        private _autoStopTimer: ReturnType<typeof setTimeout> | null = null;

        constructor(stream: MediaStream, options?: MediaRecorderOptions) {
          super(stream, options);
          this._mockBlob = audioBlob;
        }

        start(timeslice?: number) {
          console.log('[mic-mock] MediaRecorder.start() — recording simulated');
          // Emit a dataavailable event after a short delay with the pre-recorded blob
          // The real stop() will trigger onstop, which is where routing happens

          if (autoStopAfterMs) {
            this._autoStopTimer = setTimeout(() => {
              console.log(`[mic-mock] Auto-stopping after ${autoStopAfterMs}ms`);
              this.stop();
            }, autoStopAfterMs);
          }

          // Call super.start() to set state to 'recording'
          super.start(timeslice);
        }

        stop() {
          console.log('[mic-mock] MediaRecorder.stop() — delivering mock audio blob');
          if (this._autoStopTimer) {
            clearTimeout(this._autoStopTimer);
            this._autoStopTimer = null;
          }

          // Dispatch dataavailable with the mock blob before stopping
          const event = new BlobEvent('dataavailable', { data: this._mockBlob });
          this.dispatchEvent(event);
          if (this.ondataavailable) this.ondataavailable(event);

          // Call super.stop() which triggers onstop
          super.stop();
        }
      }

      // Replace the global MediaRecorder
      (window as any).MediaRecorder = MockMediaRecorder;

      console.log('[mic-mock] Mock installed — getUserMedia and MediaRecorder overridden');
    },
    { audioBase64, mimeType, autoStopAfterMs: options.autoStopAfterMs },
  );
}

/**
 * Mock the Whisper transcription API to return a specific text
 * instead of actually calling OpenAI. Works with MSW in standalone mode.
 *
 * Use this when you don't have audio files — just simulate the transcription result.
 */
export async function mockTranscriptionResult(page: Page, text: string) {
  await page.evaluate((mockText) => {
    // Override the transcribe function by intercepting fetch to the Whisper API
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;

      if (url.includes('api.openai.com') || url.includes('/api/transcribe')) {
        console.log(`[mic-mock] Whisper API intercepted — returning: "${mockText}"`);
        return new Response(JSON.stringify({ text: mockText }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return originalFetch(input, init);
    };

    console.log(`[mic-mock] Whisper API mock installed — will return: "${mockText}"`);
  }, text);
}
