/**
 * E2E Tests: Finalization shows latest clause content
 *
 * Regression test: editing clauses and immediately clicking Finalize
 * should show the latest content in the finalization preview.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

test.describe('Finalization Content Sync', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await report.goto();
    await report.selectCase('S26-0004');
  });

  test('edited clause text appears in finalization preview', async ({ page }) => {
    // Find the first textarea and modify its content
    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();
    await firstTextarea.fill('Modified adenocarcinoma text for finalization test');

    // Small pause to let triggerSave update the store
    await page.waitForTimeout(500);

    // Click Finalize
    await report.clickFinalize();

    // The finalization dialog should contain the modified text
    await expect(page.locator('[role="dialog"]')).toContainText('Modified adenocarcinoma text');
  });

  test('new clause added via Enter appears in finalization', async ({ page }) => {
    // Capture ALL console logs from the start
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('CLAUSE_INPUT') || text.includes('XDEBUG')) consoleLogs.push(text);
    });

    // Click into the last textarea
    const textareas = page.locator('textarea');
    const lastTextarea = textareas.last();
    await lastTextarea.click();

    // Press Enter to create a new clause
    await lastTextarea.press('Enter');
    await page.waitForTimeout(500);

    // Count textareas after Enter
    const countAfterEnter = await page.locator('textarea').count();
    console.log('Textareas after Enter:', countAfterEnter);

    // Type into the new (now last) textarea using keyboard
    const newTextarea = page.locator('textarea').last();
    await newTextarea.click();
    await page.waitForTimeout(200);

    // Verify focus is in the right place
    const isFocused = await newTextarea.evaluate(el => el === document.activeElement);
    console.log('New textarea focused:', isFocused);

    await newTextarea.type('Brand new ancillary finding');
    await page.waitForTimeout(500);

    await page.waitForTimeout(500);

    // Check DOM state BEFORE clicking finalize
    const domState = await page.evaluate(() => {
      const allTextareas = document.querySelectorAll('textarea');
      const partContainer = document.querySelector('[data-part-id]');
      const partTextareas = partContainer ? partContainer.querySelectorAll('textarea') : [];
      return {
        totalTextareas: allTextareas.length,
        partTextareas: partTextareas.length,
        allValues: Array.from(allTextareas).map(t => (t as HTMLTextAreaElement).value.substring(0, 40)),
      };
    });
    console.log('DOM state before finalize:', JSON.stringify(domState, null, 2));

    // Click Finalize
    await report.clickFinalize();

    // The finalization dialog should contain the new text
    await expect(page.locator('[role="dialog"]')).toContainText('Brand new ancillary finding');
  });

  test('finalize shows ONLY current case content (no cross-case contamination)', async ({ page }) => {
    // Load S26-0004 which has pre-populated clauses
    // Click finalize — should show only S26-0004's content
    await report.clickFinalize();

    const dialogContent = await page.locator('[role="dialog"]').textContent();

    // Must contain the actual case content
    expect(dialogContent).toContain('Adenocarcinoma');
    expect(dialogContent).toContain('Part A');

    // Must NOT contain content from other cases or stale mnemonic templates
    expect(dialogContent).not.toContain('Tubular adenoma');
    expect(dialogContent).not.toContain('HPV');
    expect(dialogContent).not.toContain('Microsatellite');

    // Close dialog
    await page.locator('[role="dialog"] button:has-text("Cancel")').click();
  });

  test('mnemonic insertion via Cmd+M appears in finalization', async ({ page }) => {
    // Focus the first textarea
    const firstTextarea = page.locator('textarea').first();
    await firstTextarea.click();

    // Move cursor to end
    await firstTextarea.press('End');

    // Open mnemonic popover
    await page.keyboard.press('Meta+m');
    await page.waitForTimeout(300);

    // Search for a mnemonic
    const popoverInput = page.locator('input[placeholder*="Type mnemonic"]');
    await expect(popoverInput).toBeVisible({ timeout: 2_000 });
    await popoverInput.fill('MSI');
    await page.waitForTimeout(500);

    // Select the first result (press Enter)
    await popoverInput.press('Enter');
    await page.waitForTimeout(500);

    // Click Finalize
    await report.clickFinalize();

    // The finalization dialog should contain content from the MSI mnemonic
    await expect(page.locator('[role="dialog"]')).toContainText('Microsatellite');
  });
});
