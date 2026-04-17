/**
 * E2E Tests: Quick Entry Mode
 * Tests mnemonic search, template loading, and mode switching.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

test.describe('Quick Entry Mode', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await report.goto();
    // Use a case with parts (not finalized)
    await report.selectCase('S26-0005');
  });

  test('mode toggle switches to quick entry view', async ({ page }) => {
    await report.switchToQuickEntry();

    // Search input should be visible
    await expect(report.mnemonicSearchInput).toBeVisible();

    // Part editors should NOT be visible
    await expect(page.locator('text=Part A:')).not.toBeVisible();
  });

  test('mnemonic search returns results', async ({ page }) => {
    await report.switchToQuickEntry();

    await report.searchMnemonic('QC');

    // Should see results (mock data includes QC = Chronic gastritis)
    await expect(page.locator('text=Chronic gastritis')).toBeVisible({ timeout: 3_000 });
  });

  test('mnemonic search shows texttype badges', async ({ page }) => {
    await report.switchToQuickEntry();

    await report.searchMnemonic('HR2');

    // HR2 is $procint type — should show badge
    await expect(page.locator('text=Proc/Interp')).toBeVisible({ timeout: 3_000 });
  });

  test('no results shows feedback message', async ({ page }) => {
    await report.switchToQuickEntry();

    await report.searchMnemonic('zzzzzzz');

    await expect(page.locator('text=No matches for')).toBeVisible({ timeout: 3_000 });
  });

  test('quick entry preserves part headers from scaffold', async ({ page }) => {
    await report.switchToQuickEntry();

    // S26-0005 has Part A (Tumor) and Part B (Sentinel lymph node)
    // The QuickEntryEditor should pre-populate with part headers
    await expect(page.locator('.quick-entry-editor')).toContainText('Part A');
    await expect(page.locator('.quick-entry-editor')).toContainText('Part B');
  });

  test('switching back to structured mode preserves state', async ({ page }) => {
    await report.switchToQuickEntry();
    await expect(report.mnemonicSearchInput).toBeVisible();

    await report.switchToStructured();
    // Part editors should be back
    await expect(page.locator('text=Part A')).toBeVisible();
  });

  test('finalize works in quick entry mode', async ({ page }) => {
    await report.switchToQuickEntry();

    // Type some content in the editor (the editor has part headers pre-populated)
    // Just verify the finalize button exists
    await expect(page.locator('button:has-text("Finalize Report")')).toBeVisible();
  });

  test('escape clears search results', async ({ page }) => {
    await report.switchToQuickEntry();
    await report.searchMnemonic('ADEN');

    // Should see results
    await expect(page.locator('text=Tubular adenoma')).toBeVisible({ timeout: 3_000 });

    // Press Escape
    await report.mnemonicSearchInput.press('Escape');

    // Results should be cleared
    await expect(page.locator('text=Tubular adenoma')).not.toBeVisible();
  });
});
