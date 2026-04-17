// Shared texttype display labels and badge colors for mnemonic search results.
// Used by MnemonicSearch, MnemonicPopover, and QuickEntryEditor.

export const TEXTTYPE_LABELS: Record<string, string> = {
  '$final': 'Final Dx',
  '$gross': 'Gross',
  '$synop': 'Synoptic',
  '$procint': 'Proc/Interp',
  '$procres': 'Proc Results',
  '$clindx': 'Clinical Dx',
  '$adddx': 'Addendum',
  '$review': 'Review',
  '$clinsum': 'Clinical Sum',
  '$aprelim-dx': 'Prelim Dx',
  '$n-gross': 'Neuro Gross',
  'pdy1': 'PDY1',
  'none': 'General',
};

export const TEXTTYPE_COLORS: Record<string, string> = {
  '$final': '#2563eb',
  '$gross': '#059669',
  '$synop': '#7c3aed',
  '$procint': '#d97706',
  '$procres': '#dc2626',
  '$clindx': '#0891b2',
  '$adddx': '#6d28d9',
};

export function texttypeLabel(id: string): string {
  return TEXTTYPE_LABELS[id] ?? id;
}

export function texttypeBadgeColor(id: string): string {
  return TEXTTYPE_COLORS[id] ?? '#6b7280';
}
