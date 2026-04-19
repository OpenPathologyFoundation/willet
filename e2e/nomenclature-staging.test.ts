/**
 * E2E — Nomenclature staging end-to-end (SDS 04-04 §3.1, SRS-270).
 *
 * Verifies the self-maintaining loop actually runs:
 *   1. A pathologist types a dev-harness "standardize" instruction into the
 *      prompt area. The rules-engine mock returns empty actions so PromptArea
 *      escalates to the LLM handler at /api/interpret.
 *   2. The LLM handler (dev harness) returns a set_authored_label action.
 *   3. Under the v2.3 source-based policy, LLM-sourced actions surface for
 *      explicit confirmation regardless of confidence.
 *   4. The pathologist clicks Apply. PromptArea submits a staging entry to
 *      /api/nomenclature/staging before forwarding the action to the report
 *      application layer.
 *   5. The entry shows up in the server-side staging dictionary with the
 *      correct designator → standardized mapping.
 *
 * The "designator" captured in the staging entry is whatever was on the
 * page at confirmation time (authored_label if set, else partDesignator),
 * matching SDS 04-04 §3.1's "the free-text input."
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

test.describe('Nomenclature staging lifecycle', () => {
  // Reset the in-memory staging store before each test so we observe only
  // this test's writes. Dev-only endpoint; does not exist in integrated mode.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await fetch('/api/nomenclature/_reset', { method: 'POST' });
    });
  });

  test('standardize instruction → confirm → staging entry is created', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');
    // S26-0004 Part A has authored_label 'Right colon, hemicolectomy' in the fixture,
    // so that's what the staging entry's designator should be.
    const expectedDesignator = 'Right colon, hemicolectomy';
    const newStandardized = 'Colon, right hemicolectomy, resection';

    await report.promptInput.fill(`standardize part A as "${newStandardized}"`);
    await report.promptInput.press('Enter');

    // LLM path tags source='ai_suggested'; under v2.3 this always surfaces
    // for confirmation — never auto-applies.
    await expect(page.locator('text=/Standardize Part A label/i')).toBeVisible({ timeout: 6_000 });

    // Click the Apply button in the pending-confirmation block.
    await page.locator('button:has-text("Apply")').first().click();

    // Poll the server-side staging store until the entry is persisted.
    const entries = await (async () => {
      await expect
        .poll(
          async () =>
            await page.evaluate(async () => {
              const r = await fetch('/api/nomenclature/staging');
              return r.ok ? await r.json() : [];
            }),
          { timeout: 4_000 },
        )
        .toHaveLength(1);
      return await page.evaluate(async () => {
        const r = await fetch('/api/nomenclature/staging');
        return (await r.json()) as Array<{
          designator: string;
          standardized: string;
          tier: string;
          source: string;
          confirmations?: Array<{ userId: string; caseId: string }>;
        }>;
      });
    })();

    expect(entries).toHaveLength(1);
    expect(entries[0].designator).toBe(expectedDesignator);
    expect(entries[0].standardized).toBe(newStandardized);
    expect(entries[0].tier).toBe('staging');
    expect(entries[0].source).toBe('ai_suggested');
    expect(entries[0].confirmations).toHaveLength(1);
    expect(entries[0].confirmations?.[0].caseId).toBe('S26-0004');
  });

  test('dismissing the pending confirmation does NOT create a staging entry', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');

    await report.promptInput.fill(`standardize part A as "Declined standardization"`);
    await report.promptInput.press('Enter');
    await expect(page.locator('text=/Standardize Part A label/i')).toBeVisible({ timeout: 6_000 });

    // Dismiss instead of confirming. Staging is gated on Apply, so no entry
    // should be written server-side.
    await page.locator('button:has-text("Dismiss")').first().click();

    // Give any async side effects a moment to land (they shouldn't, but we want
    // a false negative to be a real test failure, not a race).
    await page.waitForTimeout(500);

    const entries = await page.evaluate(async () => {
      const r = await fetch('/api/nomenclature/staging');
      return (await r.json()) as unknown[];
    });
    expect(entries).toHaveLength(0);
  });
});
