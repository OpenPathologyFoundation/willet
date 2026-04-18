/**
 * Page Object Model for the WILLET Report Module.
 * Encapsulates all UI interactions for E2E tests.
 */

import { Page, Locator, expect } from '@playwright/test';

export class ReportPage {
  readonly page: Page;

  // Demo harness controls (first select in the dev toolbar)
  readonly caseSelector: Locator;
  readonly themeToggle: Locator;

  // Report header
  readonly header: Locator;
  readonly caseId: Locator;
  readonly specimenType: Locator;
  readonly statusBadge: Locator;
  readonly modeToggleStructured: Locator;
  readonly modeToggleQuickEntry: Locator;
  readonly saveIndicator: Locator;

  // Structured mode
  readonly partEditors: Locator;
  readonly caseCommentToggle: Locator;
  readonly caseCommentTextarea: Locator;
  readonly finalizeButton: Locator;

  // Quick entry mode
  readonly mnemonicSearchInput: Locator;
  readonly mnemonicResults: Locator;
  readonly quickEntryEditor: Locator;

  // Prompt area
  readonly promptInput: Locator;
  readonly micButton: Locator;
  readonly sendButton: Locator;

  // Context dock
  readonly clinicalTab: Locator;
  readonly imagesTab: Locator;
  readonly synopticTab: Locator;
  readonly contextDockPanel: Locator;

  // Synoptic panel
  readonly synopticHeader: Locator;
  readonly synopticSections: Locator;
  readonly synopticApplyAll: Locator;
  readonly synopticRejectAll: Locator;
  readonly synopticOutput: Locator;
  readonly synopticFinalizeButton: Locator;
  readonly synopticProgress: Locator;

  // Finalize dialog
  readonly finalizeDialog: Locator;
  readonly finalizeDialogConfirm: Locator;
  readonly finalizeDialogCancel: Locator;

  constructor(page: Page) {
    this.page = page;

    // Demo harness — target the case selector in the dev toolbar (not clause type dropdowns)
    this.caseSelector = page.locator('.shrink-0.flex.items-center select').first();
    this.themeToggle = page.locator('button:has-text("Theme")').first();

    // Report header
    this.header = page.locator('header');
    this.caseId = page.locator('header .font-mono');
    this.specimenType = page.locator('header .text-clinical-muted').first();
    this.statusBadge = page.locator('header .rounded-full');
    this.modeToggleStructured = page.locator('button[role="radio"]:has-text("Structured")');
    this.modeToggleQuickEntry = page.locator('button[role="radio"]:has-text("Quick Entry")');
    this.saveIndicator = page.locator('[class*="SaveIndicator"]');

    // Structured mode
    this.partEditors = page.locator('.group:has([data-part])');
    this.caseCommentToggle = page.locator('button:has-text("Case Comment")');
    this.caseCommentTextarea = page.locator('textarea[placeholder*="case-level comment"]');
    this.finalizeButton = page.locator('button:has-text("Finalize Report")');

    // Quick entry
    this.mnemonicSearchInput = page.locator('input[placeholder*="Search mnemonics"]');
    this.mnemonicResults = page.locator('.quick-entry-editor button');
    this.quickEntryEditor = page.locator('.quick-entry-editor');

    // Prompt area
    this.promptInput = page.locator('textarea[placeholder*="Describe findings"]');
    this.micButton = page.locator('button[title*="Dictate"]');
    this.sendButton = page.locator('button[title*="Send"]');

    // Context dock tabs
    this.clinicalTab = page.locator('button[role="tab"]:has-text("Clinical")');
    this.imagesTab = page.locator('button[role="tab"]:has-text("Images")');
    this.synopticTab = page.locator('button[role="tab"]:has-text("Synoptic")');
    this.contextDockPanel = page.locator('[role="tabpanel"]');

    // Synoptic panel
    this.synopticHeader = page.locator('h3:has-text("Synoptic Protocol")');
    this.synopticSections = page.locator('[class*="accordion"]');
    this.synopticApplyAll = page.locator('button:has-text("Apply All")');
    this.synopticRejectAll = page.locator('button:has-text("Reject All")');
    this.synopticOutput = page.locator('text=Synoptic Report');
    this.synopticFinalizeButton = page.locator('button:has-text("Finalize Synoptic")');
    this.synopticProgress = page.locator('[class*="progress"]');

    // Finalize dialog
    this.finalizeDialog = page.locator('[role="dialog"]');
    this.finalizeDialogConfirm = page.locator('[role="dialog"] button:has-text("Finalize")');
    this.finalizeDialogCancel = page.locator('[role="dialog"] button:has-text("Cancel")');
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async goto() {
    await this.page.goto('/');
    // Wait for MSW to initialize and scaffold to load
    await this.page.waitForSelector('header', { timeout: 10_000 });
  }

  async selectCase(caseId: string) {
    await this.caseSelector.selectOption(caseId);
    // Wait for loading spinner to appear and disappear (component remounts)
    await this.page.waitForTimeout(300);
    // Wait for the new case ID to appear in the header
    await this.page.waitForFunction(
      (id) => document.querySelector('header .font-mono')?.textContent?.includes(id),
      caseId,
      { timeout: 10_000 },
    );
    // Extra settle time for reactive updates (synoptic protocol loading, etc.)
    await this.page.waitForTimeout(500);
  }

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  async switchToQuickEntry() {
    await this.modeToggleQuickEntry.click();
    await this.page.waitForSelector('.quick-entry-editor', { timeout: 3_000 });
  }

  async switchToStructured() {
    await this.modeToggleStructured.click();
    // Wait for part editors to appear
    await this.page.waitForTimeout(500);
  }

  // ---------------------------------------------------------------------------
  // Structured mode interactions
  // ---------------------------------------------------------------------------

  /** Get a clause textarea by part index and clause index */
  clauseTextarea(partIndex: number, clauseIndex: number): Locator {
    return this.page.locator(`textarea`).nth(partIndex * 5 + clauseIndex);
  }

  /** Get a part header */
  partHeader(partIndex: number): Locator {
    return this.page.locator('h3:has-text("Part")').nth(partIndex);
  }

  async typeDiagnosis(partIndex: number, clauseIndex: number, text: string) {
    const textarea = this.clauseTextarea(partIndex, clauseIndex);
    await textarea.click();
    await textarea.fill(text);
  }

  // ---------------------------------------------------------------------------
  // Case comment
  // ---------------------------------------------------------------------------

  async openCaseComment() {
    await this.caseCommentToggle.click();
    await this.page.waitForSelector('textarea[placeholder*="case-level comment"]', { timeout: 2_000 });
  }

  async typeCaseComment(text: string) {
    await this.caseCommentTextarea.fill(text);
  }

  // ---------------------------------------------------------------------------
  // Quick entry
  // ---------------------------------------------------------------------------

  async searchMnemonic(query: string) {
    await this.mnemonicSearchInput.fill(query);
    // Wait for debounced search (80ms + API response)
    await this.page.waitForTimeout(300);
  }

  async selectMnemonicResult(index: number) {
    const results = this.page.locator('[class*="quick-entry"] .border-clinical-border button').nth(index);
    await results.click();
    await this.page.waitForTimeout(200);
  }

  // ---------------------------------------------------------------------------
  // Context dock / synoptic
  // ---------------------------------------------------------------------------

  async openSynopticTab() {
    await this.synopticTab.click();
    await this.page.waitForTimeout(500);
  }

  async openClinicalTab() {
    await this.clinicalTab.click();
    await this.page.waitForTimeout(500);
  }

  /** Click a synoptic accordion section by its title text */
  async openSynopticSection(sectionTitle: string) {
    const section = this.page.locator(`button:has-text("${sectionTitle}")`).first();
    await section.click();
    await this.page.waitForTimeout(200);
  }

  /** Select a value from a synoptic dropdown */
  async setSynopticDropdown(sectionTitle: string, value: string) {
    await this.openSynopticSection(sectionTitle);
    const select = this.page.locator(`select`).last();
    await select.selectOption(value);
  }

  // ---------------------------------------------------------------------------
  // Dictation
  // ---------------------------------------------------------------------------

  async clickMicButton() {
    await this.micButton.click();
  }

  async clickStopRecording() {
    const stopBtn = this.page.locator('button[title*="Stop"]');
    await stopBtn.click();
  }

  // ---------------------------------------------------------------------------
  // Finalization
  // ---------------------------------------------------------------------------

  async clickFinalize() {
    await this.finalizeButton.click();
    await this.page.waitForSelector('[role="dialog"]', { timeout: 3_000 });
  }

  async confirmFinalize() {
    await this.finalizeDialogConfirm.click();
    await this.page.waitForTimeout(500);
  }

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  async expectCaseLoaded(caseId: string) {
    await expect(this.caseId).toContainText(caseId);
  }

  async expectStatusBadge(status: 'Draft' | 'Review' | 'Finalized') {
    await expect(this.statusBadge).toContainText(status);
  }

  async expectFinalized() {
    await expect(this.page.locator('text=finalized and transmitted')).toBeVisible();
  }

  async expectModeToggleVisible() {
    await expect(this.modeToggleStructured).toBeVisible();
    await expect(this.modeToggleQuickEntry).toBeVisible();
  }

  async expectSynopticTabEnabled() {
    const tab = this.synopticTab;
    await expect(tab).not.toHaveClass(/cursor-default/);
  }

  async expectSynopticTabDisabled() {
    const tab = this.synopticTab;
    // Disabled tabs have muted/40 opacity class
    await expect(tab).toHaveClass(/muted/);
  }
}
