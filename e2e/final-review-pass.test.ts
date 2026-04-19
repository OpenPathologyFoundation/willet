/**
 * E2E Tests — Final Review Pass at sign-out (SDS 04-03 §5.4, SRS-275 — SRS-279, UN-093 — UN-095).
 *
 * Exercises the v2.3 Final Review Pass UI:
 *   - Clean case → no review dialog, straight to FinalizeDialog (regression check).
 *   - Case with a specimen↔part-label organ mismatch → FinalReviewDialog surfaces the
 *     discrepancy and blocks Finalize until resolved.
 *   - Resolution via "Confirm as correct" enables proceed.
 *   - Resolution via "Acknowledge as intentional" requires rationale ≥10 chars (SRS-276).
 *   - "Edit" closes the dialog so the pathologist can edit the affected field.
 *   - Cancel dismisses the dialog without finalizing.
 *
 * Test strategy:
 *   - S26-0004 (colon case, pre-populated) is the baseline "clean" case.
 *   - We induce a mismatch by editing a part header's authored_label to name a different
 *     organ than the specimen. This drives the specimen_part_organ_mismatch detector.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

test.describe('Final Review Pass — clean case (regression)', () => {
  test('clean colon case proceeds straight to FinalizeDialog without review dialog', async ({ page }) => {
    const report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');

    await report.finalizeButton.click();

    // The existing FinalizeDialog opens directly because the review finds no discrepancies.
    await expect(report.finalizeDialog).toBeVisible({ timeout: 3_000 });

    // The review dialog should NOT appear when the case passes the review.
    await expect(page.locator('[data-testid="discrepancy-list"]')).toHaveCount(0);
  });
});

test.describe('Final Review Pass — mismatch detection and resolution', () => {
  /**
   * Induce a specimen ↔ part-label organ mismatch by editing the first part's header
   * to name an organ different from the case specimen. This runs in each test's
   * `beforeEach` so every test starts from the same mismatched state.
   */
  async function induceOrganMismatch(page: import('@playwright/test').Page, report: ReportPage) {
    await report.goto();
    await report.selectCase('S26-0004'); // colon case

    // Hover over the first part header to reveal the "Edit part header" button, then click it.
    const partA = page.locator('[data-part-id]').first();
    await partA.hover();
    const editBtn = partA.locator('button[title="Edit part header"]').first();
    await editBtn.click();

    // The header becomes an input bound to `headerDraft`. Replace its contents with a
    // mismatched organ label (breast) and press Enter to commit.
    const headerInput = partA.locator('input[type="text"]').first();
    await headerInput.fill('Left breast biopsy');
    await headerInput.press('Enter');

    // Allow the reactive update + autosave cycle to settle.
    await page.waitForTimeout(300);
  }

  test('FinalReviewDialog appears with a specimen↔part organ mismatch', async ({ page }) => {
    const report = new ReportPage(page);
    await induceOrganMismatch(page, report);

    await report.finalizeButton.click();

    // The review dialog surfaces instead of FinalizeDialog.
    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    // FinalizeDialog should NOT yet be visible — review blocks it.
    await expect(page.locator('[role="dialog"]').filter({ hasText: 'Review formatted report' })).toHaveCount(0);

    // The mismatch message should mention "breast" and "Colon" (the specimen organ).
    const msg = reviewDialog.locator('.discrepancy-message').first();
    await expect(msg).toContainText(/breast/i);
    await expect(msg).toContainText(/colon/i);
  });

  test('proceed is disabled while discrepancies are unresolved', async ({ page }) => {
    const report = new ReportPage(page);
    await induceOrganMismatch(page, report);

    await report.finalizeButton.click();
    const proceedBtn = page.locator('[data-testid="proceed-to-finalize"]');
    await expect(proceedBtn).toBeVisible({ timeout: 3_000 });
    await expect(proceedBtn).toBeDisabled();
  });

  test('"Confirm as correct" resolves the discrepancy and enables proceed', async ({ page }) => {
    const report = new ReportPage(page);
    await induceOrganMismatch(page, report);

    await report.finalizeButton.click();

    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    await reviewDialog.locator('button:has-text("Confirm as correct")').first().click();

    // Resolution badge appears.
    await expect(reviewDialog.locator('.resolution-badge').first()).toContainText(/Confirmed correct/);

    // Proceed becomes enabled when all (one) discrepancies resolve.
    const proceedBtn = page.locator('[data-testid="proceed-to-finalize"]');
    await expect(proceedBtn).toBeEnabled();

    // Clicking proceed opens the FinalizeDialog.
    await proceedBtn.click();
    await expect(page.locator('[role="dialog"]').filter({ hasText: 'Review formatted report' })).toBeVisible({ timeout: 3_000 });
  });

  test('"Acknowledge as intentional" requires a rationale of at least 10 characters', async ({ page }) => {
    const report = new ReportPage(page);
    await induceOrganMismatch(page, report);

    await report.finalizeButton.click();

    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    await reviewDialog.locator('button:has-text("Acknowledge as intentional")').first().click();

    const rationaleInput = reviewDialog.locator('textarea').first();
    await expect(rationaleInput).toBeVisible();

    const saveBtn = reviewDialog.locator('button:has-text("Save acknowledgment")').first();

    // Too short (< 10 chars): save button stays disabled.
    await rationaleInput.fill('short');
    await expect(saveBtn).toBeDisabled();

    // At least 10 chars: save button enables, click, discrepancy is resolved.
    await rationaleInput.fill('Correct per Dr. Jones consult, re-dictated into wrong part, verified in LIS.');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(reviewDialog.locator('.resolution-badge').first()).toContainText(/Acknowledged as intentional/);
    await expect(page.locator('[data-testid="proceed-to-finalize"]')).toBeEnabled();

    // Rationale text is visible on the resolved discrepancy (auditability).
    await expect(reviewDialog).toContainText('Correct per Dr. Jones consult');
  });

  test('"Edit" closes the review dialog so the pathologist can edit', async ({ page }) => {
    const report = new ReportPage(page);
    await induceOrganMismatch(page, report);

    await report.finalizeButton.click();

    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    await reviewDialog.locator('button:has-text("Edit")').first().click();

    // The review dialog closes. The pathologist is back in the editor.
    await expect(reviewDialog).not.toBeVisible({ timeout: 2_000 });

    // No FinalizeDialog was opened either — the pathologist needs to Finalize again after editing.
    await expect(page.locator('[role="dialog"]').filter({ hasText: 'Review formatted report' })).toHaveCount(0);
  });

  test('each resolution emits a FINAL_REVIEW_DISCREPANCY_RESOLVED audit event (SRS-279)', async ({ page }) => {
    const report = new ReportPage(page);

    // Capture all ModuleEvents emitted by the demo harness. The demo App logs them to
    // console ("[WILLET Demo] ModuleEvent: <event>"); we collect the full stringified
    // payload and parse out the events we care about after each resolution gesture.
    const auditLog: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[WILLET Demo] ModuleEvent:')) {
        auditLog.push(text);
      }
    });

    await induceOrganMismatch(page, report);
    await report.finalizeButton.click();

    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    // --- Resolution via "Confirm as correct" ---
    const beforeCount = auditLog.length;
    await reviewDialog.locator('button:has-text("Confirm as correct")').first().click();
    // Give Svelte a moment to propagate the onresolve callback + audit emit.
    await page.waitForTimeout(200);

    const confirmEvents = auditLog
      .slice(beforeCount)
      .filter((line) => line.includes('FINAL_REVIEW_DISCREPANCY_RESOLVED'));
    expect(confirmEvents.length).toBe(1);
    expect(confirmEvents[0]).toContain('"resolution": "confirm_as_correct"');
    expect(confirmEvents[0]).toContain('"discrepancyClass": "specimen_part_organ_mismatch"');
    // A confirm-as-correct resolution should NOT carry a rationale.
    expect(confirmEvents[0]).not.toContain('"rationale": "');
  });

  test('acknowledge-as-intentional audit event carries the rationale text (SRS-276, SRS-279)', async ({ page }) => {
    const report = new ReportPage(page);
    const auditLog: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[WILLET Demo] ModuleEvent:')) {
        auditLog.push(text);
      }
    });

    await induceOrganMismatch(page, report);
    await report.finalizeButton.click();

    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    const rationaleText = 'Clinically correct after Dr. Jones consult, LIS confirmed.';

    await reviewDialog.locator('button:has-text("Acknowledge as intentional")').first().click();
    await reviewDialog.locator('textarea').first().fill(rationaleText);
    await reviewDialog.locator('button:has-text("Save acknowledgment")').first().click();
    await page.waitForTimeout(200);

    const events = auditLog.filter((line) => line.includes('FINAL_REVIEW_DISCREPANCY_RESOLVED'));
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ack = events.find((e) => e.includes('acknowledge_as_intentional'));
    expect(ack).toBeDefined();
    expect(ack).toContain(rationaleText);
    expect(ack).toContain('"discrepancyClass": "specimen_part_organ_mismatch"');
  });

  test('Cancel dismisses the review dialog without finalizing', async ({ page }) => {
    const report = new ReportPage(page);
    await induceOrganMismatch(page, report);

    await report.finalizeButton.click();

    const reviewDialog = page.locator('[role="dialog"]').filter({ hasText: 'Final Review' });
    await expect(reviewDialog).toBeVisible({ timeout: 3_000 });

    // Click the footer Cancel button (not the × close button — both should work, but the
    // footer button is the canonical gesture).
    await reviewDialog.locator('.dialog-footer button:has-text("Cancel")').click();

    await expect(reviewDialog).not.toBeVisible({ timeout: 2_000 });
    await expect(page.locator('[role="dialog"]').filter({ hasText: 'Review formatted report' })).toHaveCount(0);
  });
});
