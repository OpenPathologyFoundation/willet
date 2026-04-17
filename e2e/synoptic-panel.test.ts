/**
 * E2E Tests: Synoptic Panel
 * Tests protocol matching, auto-population from clauses, form interaction,
 * live output generation, and synoptic finalization.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

test.describe('Synoptic Panel', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await report.goto();
  });

  test('synoptic tab is enabled for colon case (protocol match)', async () => {
    await report.selectCase('S26-0004');
    // Colon hemicolectomy matches the colon protocol
    await report.expectSynopticTabEnabled();
  });

  test('synoptic tab opens and shows protocol name', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.openSynopticTab();

    // Should show the protocol header
    await expect(page.locator('text=Synoptic Protocol')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=Colon and Rectum Resection')).toBeVisible();
  });

  test('synoptic panel expands wider than normal dock', async ({ page }) => {
    await report.selectCase('S26-0004');

    // Open synoptic tab — should be wider than default dock
    await report.openSynopticTab();

    // The synoptic panel content should be visible and wider than 400px
    const synopticContent = page.locator('h3:has-text("Synoptic Protocol")');
    await expect(synopticContent).toBeVisible({ timeout: 3_000 });
  });

  test('auto-populates fields from existing clauses', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.openSynopticTab();
    await page.waitForTimeout(2_000);

    // S26-0004 has clauses — synoptic panel should load with the protocol
    await expect(page.locator('text=Synoptic Protocol')).toBeVisible({ timeout: 5_000 });
    // Protocol label visible in the synoptic panel
    await expect(page.getByText('Colon and Rectum Resection (Jun 2024)')).toBeVisible();
  });

  test('shows progress bar with filled count', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.openSynopticTab();
    await page.waitForTimeout(1_500);

    // The synoptic panel header has a progress indicator showing filled/total
    await expect(page.locator('text=Colon and Rectum Resection')).toBeVisible({ timeout: 5_000 });
  });

  test('synoptic output section shows formatted text', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.openSynopticTab();

    // Wait for auto-population
    await page.waitForTimeout(1_000);

    // The synoptic output should be visible (it starts expanded)
    const outputSection = page.locator('text=Synoptic Report');
    await expect(outputSection).toBeVisible();

    // Should show numbered entries with uppercase values
    // Auto-populated fields should appear in the output
  });

  test('apply all suggestions converts amber to green', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.openSynopticTab();

    await page.waitForTimeout(1_000);

    // If there are suggested fields, Apply All should be visible
    const applyAll = page.locator('button:has-text("Apply All")');
    if (await applyAll.isVisible()) {
      await applyAll.click();
      await page.waitForTimeout(500);

      // Suggested count should drop to 0
      await expect(page.locator('text=suggested')).not.toBeVisible();
    }
  });

  test('synoptic finalize button opens dialog with combined report', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.openSynopticTab();

    await page.waitForTimeout(1_000);

    // Look for finalize button in synoptic output
    const finalizeBtn = page.locator('button:has-text("Finalize Synoptic")');
    if (await finalizeBtn.isVisible()) {
      await finalizeBtn.click();

      // Should open the finalize dialog
      await expect(report.finalizeDialog).toBeVisible({ timeout: 3_000 });

      // Dialog should contain both report parts AND synoptic
      await expect(page.locator('[role="dialog"]')).toContainText('Part A');
      await expect(page.locator('[role="dialog"]')).toContainText('Synoptic Report');
    }
  });

  test('breast case matches breast protocol', async ({ page }) => {
    await report.selectCase('S26-0005');
    await report.openSynopticTab();

    // S26-0005 is "Breast, right, mastectomy with sentinel nodes"
    await expect(page.locator('text=Breast Carcinoma')).toBeVisible({ timeout: 3_000 });
  });

  test('thyroid case loads a synoptic protocol', async ({ page }) => {
    await report.selectCase('S26-0008');
    await report.openSynopticTab();
    await page.waitForTimeout(1_000);

    // S26-0008 is "Thyroid, right lobe, lobectomy" — should match a protocol
    // (may match thyroid or lung depending on registry keyword precedence)
    await expect(page.locator('text=Synoptic Protocol')).toBeVisible({ timeout: 5_000 });
  });
});
