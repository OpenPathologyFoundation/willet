import { describe, it, expect } from 'vitest';
import { classifyInstruction, type InstructionIntent } from './instruction-classifier';
import type { LlmInstructionRequest } from '$lib/types';

function makeContext(
  partLabels: string[] = ['A', 'B'],
): LlmInstructionRequest['caseContext'] {
  return {
    caseId: 'test',
    parts: partLabels.map(label => ({
      partLabel: label,
      partDesignator: `Part ${label}`,
      authoredLabel: null,
      anatomicSite: null,
      currentClauses: [],
    })),
    specimenType: 'Colon, right hemicolectomy',
    clinicalHistory: null,
  };
}

function intentTypes(intents: InstructionIntent[]): string[] {
  return intents.map(i => i.type);
}

describe('classifyInstruction', () => {
  describe('single intents', () => {
    it('returns empty for blank input', () => {
      expect(classifyInstruction('', makeContext())).toEqual([]);
    });

    it('classifies "benign polyp" as populate_benign', () => {
      const intents = classifyInstruction('benign polyp', makeContext());
      expect(intentTypes(intents)).toEqual(['populate_benign']);
    });

    it('classifies "margins negative" as add_margin', () => {
      const intents = classifyInstruction('margins negative closest 3mm', makeContext());
      expect(intentTypes(intents)).toEqual(['add_margin']);
    });

    it('classifies "Part B has adenocarcinoma" as add_finding_to_part', () => {
      const intents = classifyInstruction('Part B has adenocarcinoma', makeContext());
      expect(intentTypes(intents)).toEqual(['add_finding_to_part']);
      expect(intents[0].params.partLabel).toBe('B');
    });

    it('classifies "two polyps and one adenoma" as populate_counted', () => {
      const intents = classifyInstruction('two polyps and one adenoma', makeContext());
      expect(intentTypes(intents)).toEqual(['populate_counted']);
    });

    it('classifies simple text as populate_fallback', () => {
      const intents = classifyInstruction('adenocarcinoma moderately differentiated', makeContext());
      expect(intentTypes(intents)).toEqual(['populate_fallback']);
    });
  });

  describe('clear and replace', () => {
    it('detects "clear entry entirely, it should say X"', () => {
      const intents = classifyInstruction(
        'clear entry entirely, it should say acinar adenocarcinoma',
        makeContext(),
      );
      expect(intentTypes(intents)).toContain('clear_and_replace');
      const clearIntent = intents.find(i => i.type === 'clear_and_replace')!;
      expect(clearIntent.params.replacementContent).toContain('acinar adenocarcinoma');
    });

    it('detects "start over and set it to X"', () => {
      const intents = classifyInstruction(
        'start over and set it to hyperplastic polyp',
        makeContext(),
      );
      expect(intentTypes(intents)).toContain('clear_and_replace');
    });

    it('handles clear without replacement content', () => {
      const intents = classifyInstruction('clear entry entirely', makeContext());
      expect(intentTypes(intents)).toContain('clear_and_replace');
      const clearIntent = intents.find(i => i.type === 'clear_and_replace')!;
      expect(clearIntent.params.replacementContent).toBeNull();
    });
  });

  describe('replace/update clause', () => {
    it('detects "change the diagnosis to X"', () => {
      const intents = classifyInstruction(
        'change the diagnosis to well differentiated adenocarcinoma',
        makeContext(),
      );
      expect(intentTypes(intents)).toContain('replace_clause');
      const intent = intents.find(i => i.type === 'replace_clause')!;
      expect(intent.params.replacementContent).toContain('well differentiated adenocarcinoma');
    });

    it('detects "fix the margin to uninvolved"', () => {
      const intents = classifyInstruction(
        'fix the margin to surgical margins uninvolved',
        makeContext(),
      );
      expect(intentTypes(intents)).toContain('replace_clause');
    });
  });

  describe('modify within clause', () => {
    it('detects "moderately instead of well differentiated"', () => {
      const intents = classifyInstruction('moderately instead of well differentiated', makeContext());
      expect(intentTypes(intents)).toContain('modify_within_clause');
      const intent = intents.find(i => i.type === 'modify_within_clause')!;
      expect(intent.params.newText).toContain('moderately');
      expect(intent.params.oldText).toContain('well differentiated');
    });

    it('detects "replace adenocarcinoma with adenoma"', () => {
      const intents = classifyInstruction('replace adenocarcinoma with adenoma', makeContext());
      expect(intentTypes(intents)).toContain('modify_within_clause');
      const intent = intents.find(i => i.type === 'modify_within_clause')!;
      expect(intent.params.oldText).toContain('adenocarcinoma');
      expect(intent.params.newText).toContain('adenoma');
    });

    it('detects "swap polyp for adenoma"', () => {
      const intents = classifyInstruction('swap polyp for adenoma', makeContext());
      expect(intentTypes(intents)).toContain('modify_within_clause');
    });

    it('detects "change the grade to 3" as field modification', () => {
      const intents = classifyInstruction('change the grade to 3', makeContext());
      expect(intentTypes(intents)).toContain('modify_within_clause');
      const intent = intents.find(i => i.type === 'modify_within_clause')!;
      expect(intent.params.fieldHint).toContain('grade');
      expect(intent.params.newText).toBe('3');
    });

    it('does NOT trigger for "change the diagnosis to X" (that is replace_clause)', () => {
      const intents = classifyInstruction('change the diagnosis to adenoma', makeContext());
      expect(intentTypes(intents)).not.toContain('modify_within_clause');
      expect(intentTypes(intents)).toContain('replace_clause');
    });

    it('detects "replace X with Y in Part B"', () => {
      const intents = classifyInstruction('replace polyp with adenoma in Part B', makeContext());
      expect(intentTypes(intents)).toContain('modify_within_clause');
      const intent = intents.find(i => i.type === 'modify_within_clause')!;
      expect(intent.params.partLabel).toBe('B');
    });
  });

  describe('remove clause', () => {
    it('detects "remove the margin"', () => {
      const intents = classifyInstruction('remove the margin', makeContext());
      expect(intentTypes(intents)).toContain('remove_clause');
      const intent = intents.find(i => i.type === 'remove_clause')!;
      expect(intent.params.clauseType).toBe('MARGIN');
    });

    it('detects "delete the comment from Part A"', () => {
      const intents = classifyInstruction('delete the comment from Part A', makeContext());
      expect(intentTypes(intents)).toContain('remove_clause');
      const intent = intents.find(i => i.type === 'remove_clause')!;
      expect(intent.params.clauseType).toBe('COMMENT');
      expect(intent.params.partLabel).toBe('A');
    });
  });

  describe('correct prior', () => {
    it('detects "actually it\'s adenoma"', () => {
      const intents = classifyInstruction("actually it's adenoma", makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
      const intent = intents.find(i => i.type === 'correct_prior')!;
      expect(intent.params.correctedContent).toContain('adenoma');
    });

    it('detects "no wait, three polyps"', () => {
      const intents = classifyInstruction('no wait, three polyps', makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
    });

    it('detects "scratch that"', () => {
      const intents = classifyInstruction('scratch that', makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
    });

    it('detects "scratch that, it\'s benign"', () => {
      const intents = classifyInstruction("scratch that, it's benign", makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
      const intent = intents.find(i => i.type === 'correct_prior')!;
      expect(intent.params.correctedContent).toBeTruthy();
    });

    it('detects "not carcinoma, adenoma" as substitution', () => {
      const intents = classifyInstruction('not carcinoma, adenoma', makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
      const intent = intents.find(i => i.type === 'correct_prior')!;
      expect(intent.params.wrongText).toContain('carcinoma');
      expect(intent.params.correctedContent).toContain('adenoma');
    });

    it('detects "I said adenoma not carcinoma"', () => {
      const intents = classifyInstruction('I said adenoma not carcinoma', makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
      const intent = intents.find(i => i.type === 'correct_prior')!;
      expect(intent.params.correctedContent).toContain('adenoma');
    });

    it('does NOT trigger for "not identified" (medical phrase)', () => {
      const intents = classifyInstruction('perineural invasion not identified, but suspicious', makeContext());
      expect(intentTypes(intents)).not.toContain('correct_prior');
    });

    it('detects "sorry, it should be tubular adenoma"', () => {
      const intents = classifyInstruction('sorry, it should be tubular adenoma', makeContext());
      expect(intentTypes(intents)).toContain('correct_prior');
    });
  });

  describe('repeat prior', () => {
    it('detects "same for Part B"', () => {
      const intents = classifyInstruction('same for Part B', makeContext());
      expect(intentTypes(intents)).toContain('repeat_prior');
      const intent = intents.find(i => i.type === 'repeat_prior')!;
      expect(intent.params.targetPartLabel).toBe('B');
    });

    it('detects "ditto"', () => {
      const intents = classifyInstruction('ditto', makeContext());
      expect(intentTypes(intents)).toContain('repeat_prior');
      const intent = intents.find(i => i.type === 'repeat_prior')!;
      expect(intent.params.targetPartLabel).toBeNull();
    });

    it('detects "ditto C"', () => {
      const intents = classifyInstruction('ditto C', makeContext());
      expect(intentTypes(intents)).toContain('repeat_prior');
      const intent = intents.find(i => i.type === 'repeat_prior')!;
      expect(intent.params.targetPartLabel).toBe('C');
    });

    it('detects "same for the rest"', () => {
      const intents = classifyInstruction('same for the rest', makeContext());
      expect(intentTypes(intents)).toContain('repeat_prior');
      const intent = intents.find(i => i.type === 'repeat_prior')!;
      expect(intent.params.targetPartLabel).toBe('_remaining');
    });

    it('detects "Part C too"', () => {
      const intents = classifyInstruction('Part C too', makeContext());
      expect(intentTypes(intents)).toContain('repeat_prior');
      const intent = intents.find(i => i.type === 'repeat_prior')!;
      expect(intent.params.targetPartLabel).toBe('C');
    });

    it('detects "Part B as well"', () => {
      const intents = classifyInstruction('Part B as well', makeContext());
      expect(intentTypes(intents)).toContain('repeat_prior');
      const intent = intents.find(i => i.type === 'repeat_prior')!;
      expect(intent.params.targetPartLabel).toBe('B');
    });
  });

  describe('format directives', () => {
    it('extracts "capitalize" directive', () => {
      const intents = classifyInstruction(
        'adenocarcinoma, capitalize',
        makeContext(),
      );
      const formats = intents.filter(i => i.type === 'format_directive');
      expect(formats).toHaveLength(1);
      expect(formats[0].params.directives).toContain('capitalize');
    });

    it('extracts "use symbols instead of words"', () => {
      const intents = classifyInstruction(
        'gleason score 3 plus 4 equals 7, use symbols instead of words',
        makeContext(),
      );
      const formats = intents.filter(i => i.type === 'format_directive');
      expect(formats).toHaveLength(1);
      expect(formats[0].params.directives).toContain('use_symbols');
    });

    it('extracts "up to standard" as standard_format', () => {
      const intents = classifyInstruction(
        'make sure the diagnosis up to standard',
        makeContext(),
      );
      const formats = intents.filter(i => i.type === 'format_directive');
      expect(formats.length).toBeGreaterThanOrEqual(1);
      expect(formats.some(f => (f.params.directives as string[]).includes('standard_format'))).toBe(true);
    });
  });

  describe('compound instructions', () => {
    it('splits "set X, and also add Y"', () => {
      const intents = classifyInstruction(
        'benign polyp, and also make sure the diagnosis up to standard',
        makeContext(),
      );
      // Should have at least a content intent and a format directive
      expect(intents.length).toBeGreaterThanOrEqual(2);
    });

    it('handles the user example instruction', () => {
      // The exact problematic instruction from the user
      const intents = classifyInstruction(
        'So, can you clear entry entirely? it should say acinar adenocarcinoma gleason score 3 plus 4 equals 7 and use the plus and equal sign instead of using words. isop grade should be capitalized group 2, so make sure that the diagnosis up to standard.',
        makeContext(),
      );
      // Should detect clear_and_replace + format directives (use_symbols, standard_format)
      const types = intentTypes(intents);
      expect(types).toContain('clear_and_replace');
      // Should have format directives
      const formatIntents = intents.filter(i => i.type === 'format_directive');
      expect(formatIntents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('priority / mutual exclusion', () => {
    it('margin handler fires when "margins " has trailing content', () => {
      // "/\bmargins?\s/" requires a space after "margin(s)", so this triggers the margin handler
      const intents = classifyInstruction('margins negative closest 3 mm for Part B', makeContext());
      expect(intentTypes(intents)).toContain('add_margin');
      const marginIntent = intents.find(i => i.type === 'add_margin')!;
      expect(marginIntent.params.partLabel).toBe('B');
    });

    it('part-ref handler fires when "margins" is at end of string (no trailing space)', () => {
      // "Part B has positive margins" — no space after "margins" → part-ref wins
      const intents = classifyInstruction('Part B has positive margins', makeContext());
      expect(intentTypes(intents)).toContain('add_finding_to_part');
    });

    it('benign does not trigger for "benign adenoma" (contains adenoma)', () => {
      const intents = classifyInstruction('benign adenoma', makeContext());
      expect(intentTypes(intents)).not.toContain('populate_benign');
    });

    it('measurement words are not parsed as count: "closest to three millimeters"', () => {
      const intents = classifyInstruction(
        'surgical margins negative closest to three millimeters',
        makeContext(),
      );
      // Should be margin, not counted
      expect(intentTypes(intents)).toContain('add_margin');
      expect(intentTypes(intents)).not.toContain('populate_counted');
    });
  });
});
