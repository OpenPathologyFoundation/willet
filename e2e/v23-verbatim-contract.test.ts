/**
 * E2E Tests — v2.3 Verbatim Contract for Direct Dictation
 *
 * Covers the UN-092 / SRS-187 (revised) / SRS-188 (revised) behavior:
 *   - Dictation into a focused clause field inserts the Layer-1-corrected
 *     transcript verbatim. NO semantic normalization, NO clinical-to-clerical
 *     rewrite, NO clause-type-specific rephrasing.
 *   - When Layer 1 applied a correction, the undo stack has two levels:
 *       first Ctrl+Z reveals the raw STT transcript,
 *       second Ctrl+Z reverts the entire dictation.
 *   - When no correction was applied, the stack has one level (revert).
 *   - The prompt-area (conversational) path is unchanged by these rules; it
 *     still applies LLM interpretation with clinical-prose output.
 *
 * Covers the architectural reconciliation documented in:
 *   - qms/dhf/01-URS.md §5.27 (UN-090 — UN-095)
 *   - qms/dhf/02-SRS.md §3.28 (SRS-270 — SRS-279)
 *   - qms/dhf/04-SDS/03-Voice-LLM-Architecture.md §1.5, §2.2, §14, §16
 *
 * Test strategy: each test drives the real UI, mocks Whisper with a known
 * transcript, and inspects the resulting clause textarea values and undo state.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';
import { injectMicMock, mockTranscriptionResult } from './fixtures/mic-mock';

const SILENT_AUDIO_FIXTURE = 'sample-silence.webm';

test.describe('v2.3 — Clause-direct dictation verbatim contract (UN-092, SRS-187 revised)', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await page.context().grantPermissions(['microphone']);
    await report.goto();
    await report.selectCase('S26-0004'); // colon case with pre-populated clauses
  });

  /**
   * Returns the portion of text that was appended to the clause by the dictation event —
   * what the pathologist actually dictated, minus whatever was already in the clause.
   * S26-0004 ships with pre-populated clauses, so we MUST compare the delta rather than
   * the full value, otherwise we'd accidentally match pre-existing clinical prose.
   */
  async function capturedDictation(page: import('@playwright/test').Page, pre: string): Promise<string> {
    const post = await page.locator('textarea').first().inputValue();
    return post.slice(pre.length).trim();
  }

  test('"mod diff adenocarcinoma" dictated into DIAGNOSIS clause appears verbatim (not normalized)', async ({ page }) => {
    const shorthandTranscript = 'mod diff adenocarcinoma';

    await injectMicMock(page, SILENT_AUDIO_FIXTURE, { autoStopAfterMs: 500 });
    await mockTranscriptionResult(page, shorthandTranscript);

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    const pre = await firstTextarea.inputValue();
    await page.waitForTimeout(150); // exceeds the 150ms debounce in voiceStore

    await report.clickMicButton();
    // Full pipeline: audio capture → transcription mock → Layer 1 → insertion
    await page.waitForTimeout(3_000);

    const added = await capturedDictation(page, pre);

    // The verbatim contract: the shorthand must appear literally in the inserted portion.
    // The v2.1/v2.2 design would have rewritten this to "Adenocarcinoma, moderately differentiated."
    expect(added.toLowerCase()).toContain('mod diff');
    expect(added.toLowerCase()).toContain('adenocarcinoma');

    // Regression guard: the clinical-prose form must NOT appear in the *newly inserted* text.
    // (The clause may already contain that phrase from its pre-populated content — that's fine.)
    expect(added.toLowerCase()).not.toContain('moderately differentiated');
  });

  test('"margins are great" dictated into a clause field is NOT rewritten to canonical margin language', async ({ page }) => {
    const shorthandTranscript = 'margins are great';

    await injectMicMock(page, SILENT_AUDIO_FIXTURE, { autoStopAfterMs: 500 });
    await mockTranscriptionResult(page, shorthandTranscript);

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    const pre = await firstTextarea.inputValue();
    await page.waitForTimeout(150);

    await report.clickMicButton();
    await page.waitForTimeout(3_000);

    const added = await capturedDictation(page, pre);

    expect(added.toLowerCase()).toContain('margins are great');
    // The obsolete v2.1/v2.2 design would have emitted "Surgical margins uninvolved by carcinoma."
    expect(added.toLowerCase()).not.toContain('uninvolved by carcinoma');
    expect(added.toLowerCase()).not.toContain('surgical margins uninvolved');
  });

  test('LVI shorthand dictated into a clause stays as "LVI" (no abbreviation expansion)', async ({ page }) => {
    const shorthandTranscript = 'LVI identified';

    await injectMicMock(page, SILENT_AUDIO_FIXTURE, { autoStopAfterMs: 500 });
    await mockTranscriptionResult(page, shorthandTranscript);

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    const pre = await firstTextarea.inputValue();
    await page.waitForTimeout(150);

    await report.clickMicButton();
    await page.waitForTimeout(3_000);

    const added = await capturedDictation(page, pre);

    expect(added).toContain('LVI');
    // The obsolete normalizer would have expanded LVI → "lymphovascular invasion".
    expect(added.toLowerCase()).not.toContain('lymphovascular invasion');
  });
});

test.describe('v2.3 — Direct dictation undo model (SRS-188 revised)', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await page.context().grantPermissions(['microphone']);
    await report.goto();
    await report.selectCase('S26-0004'); // colon case with pre-populated clauses
  });

  test('with corrections: first Ctrl+Z reveals raw STT, second Ctrl+Z reverts entire dictation', async ({ page }) => {
    // Transcript chosen to trigger the deterministic colon confusion-pair:
    //   "cervical margins" → "surgical margins"  (mcp-server/data/pathology-vocabulary.json)
    // S26-0004 is a colon case, so Layer 1 fires and `corrections.length > 0` in handleDictation.
    // This exercises the two-level undo branch in insertDictation that the other tests skip.
    const rawTranscript = 'cervical margins uninvolved';
    const expectedCorrection = 'surgical margins uninvolved';

    await injectMicMock(page, SILENT_AUDIO_FIXTURE, { autoStopAfterMs: 500 });
    await mockTranscriptionResult(page, rawTranscript);

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    const pre = await firstTextarea.inputValue();
    await page.waitForTimeout(150);

    await report.clickMicButton();
    await page.waitForTimeout(3_000);

    // After dictation: the corrected transcript is inserted verbatim (no further normalization).
    const afterDictation = await firstTextarea.inputValue();
    const addedDictation = afterDictation.slice(pre.length).trim();
    expect(addedDictation.toLowerCase()).toContain(expectedCorrection);

    // First Ctrl+Z: peels back the Layer 1 correction; raw STT is revealed in the clause.
    const modZ = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
    await firstTextarea.focus();
    await firstTextarea.press(modZ);
    await page.waitForTimeout(300);

    const afterFirstUndo = await firstTextarea.inputValue();
    const addedAfterFirstUndo = afterFirstUndo.slice(pre.length).trim();
    expect(addedAfterFirstUndo.toLowerCase()).toContain(rawTranscript);
    // Regression: the raw form ("cervical margins") was revealed — the correction was peeled back.
    expect(addedAfterFirstUndo.toLowerCase()).not.toContain('surgical margins');

    // Second Ctrl+Z: reverts the entire dictation — clause returns to pre-dictation state.
    await firstTextarea.focus();
    await firstTextarea.press(modZ);
    await page.waitForTimeout(300);

    const afterSecondUndo = await firstTextarea.inputValue();
    expect(afterSecondUndo).toBe(pre);
  });

  test('without corrections: single Ctrl+Z reverts the entire dictation', async ({ page }) => {
    const transcript = 'invasive ductal carcinoma';

    await injectMicMock(page, SILENT_AUDIO_FIXTURE, { autoStopAfterMs: 500 });
    await mockTranscriptionResult(page, transcript);

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    const pre = await firstTextarea.inputValue();
    await page.waitForTimeout(150);

    await report.clickMicButton();
    await page.waitForTimeout(3_000);

    // Dictation was inserted (verbatim per verbatim contract above).
    const afterDictation = await firstTextarea.inputValue();
    expect(afterDictation.toLowerCase()).toContain('invasive ductal carcinoma');
    expect(afterDictation.length).toBeGreaterThan(pre.length);

    // Undo via the app's part-level handler. We press the mod+Z directly on the textarea
    // locator so Playwright dispatches the keydown while the textarea has focus (and the
    // handler on the part <div> bubble-catches it; see handlePartKeydown in PartEditor.svelte).
    const modZ = process.platform === 'darwin' ? 'Meta+z' : 'Control+z';
    await firstTextarea.focus();
    await firstTextarea.press(modZ);
    await page.waitForTimeout(300);

    const afterUndo = await firstTextarea.inputValue();
    // SRS-188 revised: without corrections the undo stack has one level, and a single
    // Ctrl+Z reverts the entire dictation — clause returns to pre-dictation state.
    expect(afterUndo).toBe(pre);
  });
});

test.describe('v2.3 — Prompt-area path unchanged by verbatim contract', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004'); // colon case with pre-populated clauses
  });

  test('conversational typed instruction clears prompt input after submit', async ({ page }) => {
    // Prompt-area path: typed instructions flow through the LLM pipeline.
    // We verify the submit handshake completes (input clears) rather than asserting
    // on LLM output content, which varies by MSW handler behavior.
    await report.promptInput.fill('Add a diagnosis of invasive ductal carcinoma to part A');
    const textBefore = await report.promptInput.inputValue();
    expect(textBefore.length).toBeGreaterThan(0);

    await report.sendButton.click();

    // Prompt handling is asynchronous (rules → optional MCP call → apply).
    // We wait for the pipeline to settle; the input clears on successful submission.
    await page.waitForTimeout(3_000);

    const textAfter = await report.promptInput.inputValue();
    expect(textAfter).toBe('');
  });
});

test.describe('v2.3 — Dictation indicator surfaces mode at recording start', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await page.context().grantPermissions(['microphone']);
    await report.goto();
    await report.selectCase('S26-0004'); // colon case with pre-populated clauses
  });

  test('clause-focused recording shows direct-dictation target label', async ({ page }) => {
    await injectMicMock(page, SILENT_AUDIO_FIXTURE, { autoStopAfterMs: 2_500 });
    await mockTranscriptionResult(page, 'test dictation');

    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    await page.waitForTimeout(150);

    await report.clickMicButton();

    // The DictationIndicator overlay should announce the target while recording.
    // It uses role=status so any assistive tech sees it.
    const indicator = page.locator('[role="status"]').filter({ hasText: /Dictating into Part|Conversational/ });
    await expect(indicator).toBeVisible({ timeout: 1_500 });

    // Wait for auto-stop to clean up.
    await page.waitForTimeout(3_000);
  });
});
