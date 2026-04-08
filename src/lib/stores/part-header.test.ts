// Unit tests — part header rendering logic
// SDS 04-01 §3.3, Addendum §8.1.2

import { describe, it, expect } from 'vitest';
import type { PartData } from '$lib/types';

// These functions mirror the derived logic in PartEditor.svelte.
// Extracted here for testability without component rendering.

function getDisplayLabel(part: PartData): string {
  return part.metadata.authored_label ?? part.partDesignator ?? '';
}

function shouldShowReceivedAs(part: PartData): boolean {
  const authoredLabel = part.metadata.authored_label;
  return (
    authoredLabel != null &&
    authoredLabel !== '' &&
    authoredLabel !== part.partDesignator &&
    part.partDesignator != null
  );
}

function makePart(overrides: Partial<PartData> = {}): PartData {
  return {
    id: 'part-1',
    partLabel: 'A',
    partDesignator: 'Part A',
    anatomicSite: null,
    finalDiagnosis: null,
    metadata: {},
    slides: [],
    ...overrides,
  };
}

describe('part header display label', () => {
  it('uses partDesignator when no authored_label', () => {
    expect(getDisplayLabel(makePart())).toBe('Part A');
  });

  it('uses authored_label when set', () => {
    expect(
      getDisplayLabel(makePart({ metadata: { authored_label: 'Colon, sigmoid' } })),
    ).toBe('Colon, sigmoid');
  });

  it('returns empty string when both are null', () => {
    expect(
      getDisplayLabel(makePart({ partDesignator: null })),
    ).toBe('');
  });

  it('uses authored_label even if empty string', () => {
    // An empty authored_label means user cleared it — show empty
    expect(
      getDisplayLabel(makePart({ metadata: { authored_label: '' } })),
    ).toBe('');
  });
});

describe('received-as parenthetical', () => {
  it('does not show when no authored_label', () => {
    expect(shouldShowReceivedAs(makePart())).toBe(false);
  });

  it('does not show when authored_label matches partDesignator', () => {
    expect(
      shouldShowReceivedAs(makePart({ metadata: { authored_label: 'Part A' } })),
    ).toBe(false);
  });

  it('shows when authored_label differs from partDesignator', () => {
    expect(
      shouldShowReceivedAs(
        makePart({ metadata: { authored_label: 'Colon, sigmoid' } }),
      ),
    ).toBe(true);
  });

  it('does not show when authored_label is empty string', () => {
    expect(
      shouldShowReceivedAs(makePart({ metadata: { authored_label: '' } })),
    ).toBe(false);
  });

  it('does not show when partDesignator is null', () => {
    expect(
      shouldShowReceivedAs(
        makePart({
          partDesignator: null,
          metadata: { authored_label: 'Something' },
        }),
      ),
    ).toBe(false);
  });
});
