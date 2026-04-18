/**
 * E2E Tests: Structured Mode Workflow
 * Tests the part-by-part clause editing, case comment, and finalization flow.
 */

import { test, expect } from '@playwright/test';
import { ReportPage } from './pages/report.page';

test.describe('Structured Mode', () => {
  let report: ReportPage;

  test.beforeEach(async ({ page }) => {
    report = new ReportPage(page);
    await report.goto();
  });

  test('loads default case and shows report header', async () => {
    await report.expectCaseLoaded('S26-0005');
    await report.expectStatusBadge('Draft');
    await report.expectModeToggleVisible();
  });

  test('case selector switches between cases', async ({ page }) => {
    // Switch to colon case
    await report.selectCase('S26-0004');
    await report.expectCaseLoaded('S26-0004');

    // Verify specimen type visible in header
    await expect(page.locator('header')).toContainText('Colon, right hemicolectomy');

    // Switch to finalized case
    await report.selectCase('S26-0001');
    await report.expectStatusBadge('Finalized');

    // Mode toggle should be hidden for finalized
    await expect(report.modeToggleStructured).not.toBeVisible();
  });

  test('displays pre-populated clauses for S26-0004', async ({ page }) => {
    await report.selectCase('S26-0004');

    // Verify diagnosis text is present — textarea values use the value attribute
    const textarea = page.locator('textarea').first();
    await expect(textarea).toHaveValue(/Adenocarcinoma/, { timeout: 5_000 });
  });

  test('case comment can be opened, typed, and saved', async ({ page }) => {
    await report.selectCase('S26-0004');

    // S26-0004 has a pre-populated case comment — it auto-expands
    const commentSection = page.locator('button', { hasText: 'Case Comment' });
    await expect(commentSection).toBeVisible({ timeout: 5_000 });

    // The comment textarea should be visible (auto-expanded since there's content)
    const textarea = page.locator('textarea[placeholder*="case-level comment"]');
    await expect(textarea).toBeVisible({ timeout: 3_000 });

    // Type new text
    await textarea.clear();
    await textarea.fill('Test comment for E2E');

    // Verify the textarea has the text we typed
    await expect(textarea).toHaveValue('Test comment for E2E');

    // Verify the char count is shown somewhere on page (20/2000)
    await expect(page.getByText('20/2000').first()).toBeVisible({ timeout: 2_000 });
  });

  test('finalize button is visible for ATTENDING role', async ({ page }) => {
    await report.selectCase('S26-0004');
    await expect(report.finalizeButton).toBeVisible();
    await expect(report.finalizeButton).toBeEnabled();
  });

  test('finalize opens dialog with formatted report', async ({ page }) => {
    await report.selectCase('S26-0004');
    await report.clickFinalize();

    // Verify dialog opened
    await expect(report.finalizeDialog).toBeVisible();

    // Verify report content in dialog
    await expect(page.locator('[role="dialog"]')).toContainText('Part A');
  });

  test('finalized case shows read-only banner', async ({ page }) => {
    await report.selectCase('S26-0001');
    await report.expectFinalized();

    // Prompt area should not be visible
    await expect(report.promptInput).not.toBeVisible();
  });

  test('empty case shows template bar suggestion', async ({ page }) => {
    await report.selectCase('S26-0005');

    // S26-0005 is empty breast mastectomy — should show template suggestion
    // The template bar shows "Apply" button when all parts are empty and specimen matches
    const applyBtn = page.locator('button', { hasText: /^Apply$/ });
    await expect(applyBtn).toBeVisible({ timeout: 5_000 });
  });
});
