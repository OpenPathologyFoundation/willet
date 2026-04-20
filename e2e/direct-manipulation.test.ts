/**
 * E2E — direct-manipulation UX on the part authored_label
 * (SDS 04-04 §4.2 hover edit/confirm, §4.3 double-click inline edit).
 *
 * Covers:
 *   - Double-click on a part label enters inline edit mode.
 *   - Keyboard E / F2 on a focused label enters edit mode.
 *   - Keyboard Enter on a focused label with a staging-tier provenance
 *     appends a confirmation to the matching staging entry.
 *   - The "Confirmed" flash renders briefly after a confirm.
 *
 * Test strategy: use the existing dev-harness standardize pattern to create
 * a staging entry, reload the case so the provenance badge renders, then
 * exercise the UX affordances.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

async function seedStagingEntry(page: import('@playwright/test').Page, standardizedLabel: string) {
  const report = new ReportPage(page);
  await report.goto();
  await page.evaluate(async () => {
    await fetch('/api/nomenclature/_reset', { method: 'POST' });
  });
  await report.selectCase('S26-0004');

  // Dev-harness pattern produces a set_authored_label action tagged ai_suggested.
  await report.promptInput.fill(`standardize part A as "${standardizedLabel}"`);
  await report.promptInput.press('Enter');
  await expect(page.locator('text=/Standardize Part A label/i')).toBeVisible({ timeout: 6_000 });
  await page.locator('button:has-text("Apply")').first().click();

  // Wait for the staging store to persist the entry.
  await expect
    .poll(
      async () =>
        await page.evaluate(async () => {
          const r = await fetch('/api/nomenclature/staging');
          return r.ok ? ((await r.json()) as unknown[]).length : 0;
        }),
      { timeout: 4_000 },
    )
    .toBe(1);
}

test.describe('Part label direct manipulation (SDS 04-04 §4.2, §4.3)', () => {
  test('double-click on the authored_label enters inline edit mode', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');

    // S26-0004 Part A has authored_label "Right colon, hemicolectomy" per fixture.
    const label = page.locator('[data-part-id]').first().getByRole('button', {
      name: /Part A label:/i,
    });
    await expect(label).toBeVisible();
    await label.dblclick();

    // An input box appears bound to headerDraft — the edit UI.
    const input = page.locator('[data-part-id]').first().locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 2_000 });
  });

  test('pressing E on a focused label enters edit mode', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');

    const label = page.locator('[data-part-id]').first().getByRole('button', {
      name: /Part A label:/i,
    });
    await label.focus();
    await label.press('e');

    const input = page.locator('[data-part-id]').first().locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 2_000 });
  });

  test('pressing F2 on a focused label enters edit mode', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');

    const label = page.locator('[data-part-id]').first().getByRole('button', {
      name: /Part A label:/i,
    });
    await label.focus();
    await label.press('F2');

    const input = page.locator('[data-part-id]').first().locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 2_000 });
  });

  test('clicking outside the label input commits and exits edit mode', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');

    const part = page.locator('[data-part-id]').first();
    const label = part.getByRole('button', { name: /Part A label:/i });
    await label.dblclick();

    const input = part.locator('input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 2_000 });

    // Modify the draft and then click on a non-interactive region elsewhere
    // (the case header area). This was unreliable before the document-level
    // pointerdown listener was added.
    await input.fill('Right colon, hemicolectomy, edited via click-outside');
    await page.locator('header').first().click();

    // Input should be gone; displayLabel reflects the new value.
    await expect(input).not.toBeVisible({ timeout: 2_000 });
    await expect(
      part.getByRole('button', {
        name: /Part A label: Right colon, hemicolectomy, edited via click-outside/i,
      }),
    ).toBeVisible({ timeout: 2_000 });
  });
});

test.describe('Staging-entry confirm via keyboard / click (SDS 04-04 §4.2)', () => {
  test('Enter on a focused staging-tier label appends a confirmation', async ({ page }) => {
    const report = new ReportPage(page);
    const standardizedLabel = 'Colon, right hemicolectomy, resection';
    await seedStagingEntry(page, standardizedLabel);

    // Reload the case so the PartEditor re-derives labelProvenance from the
    // now-loaded nomenclature store (ReportModule.onMount triggers loadAll).
    await report.selectCase('S26-0004');

    const label = page.locator('[data-part-id]').first().getByRole('button', {
      name: /Part A label:/i,
    });
    await expect(label).toBeVisible();
    // The provenance badge should render near the label.
    await expect(page.locator('[data-part-id]').first().locator('text=/staged|AI, verify/i').first())
      .toBeVisible({ timeout: 3_000 });

    await label.focus();
    await label.press('Enter');

    // Poll the server-side entry for an incremented confirmation count.
    await expect
      .poll(
        async () =>
          await page.evaluate(async () => {
            const r = await fetch('/api/nomenclature/staging');
            const list = (await r.json()) as Array<{ confirmations?: unknown[] }>;
            return list[0]?.confirmations?.length ?? 0;
          }),
        { timeout: 4_000 },
      )
      .toBe(2);

    // "Confirmed" feedback flash briefly renders near the label.
    await expect(page.locator('[data-part-id]').first().locator('text=Confirmed'))
      .toBeVisible({ timeout: 2_000 });
  });

  test('clicking the hover-revealed Confirm button appends a confirmation', async ({ page }) => {
    const report = new ReportPage(page);
    const standardizedLabel = 'Colon, right hemicolectomy, resection — click variant';
    await seedStagingEntry(page, standardizedLabel);
    await report.selectCase('S26-0004');

    const partContainer = page.locator('[data-part-id]').first();
    await expect(partContainer.locator('text=/staged|AI, verify/i').first())
      .toBeVisible({ timeout: 3_000 });

    // Hover reveals the affordance group; Playwright hover is synchronous.
    await partContainer.hover();
    const confirmBtn = partContainer.getByRole('button', {
      name: /Confirm part label as correct/i,
    });
    await expect(confirmBtn).toBeVisible({ timeout: 2_000 });
    await confirmBtn.click();

    await expect
      .poll(
        async () =>
          await page.evaluate(async () => {
            const r = await fetch('/api/nomenclature/staging');
            const list = (await r.json()) as Array<{ confirmations?: unknown[] }>;
            return list[0]?.confirmations?.length ?? 0;
          }),
        { timeout: 4_000 },
      )
      .toBe(2);
  });
});
