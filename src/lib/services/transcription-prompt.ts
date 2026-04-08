// Transcription Prompt Vocabulary — Layer 0 of voice post-processing
// SDS 04-03 §16.2a, SRS-190
// Contextual prompt seeding: builds a vocabulary hint string for the STT model
// so domain-specific terms are transcribed correctly at source.

/**
 * Organ-specific vocabulary lists.
 * These terms are passed as the `prompt` parameter to the transcription API
 * (OpenAI Whisper / gpt-4o-transcribe) to bias the model toward correct
 * domain terminology before transcription begins.
 *
 * The vocabulary is drawn from the *correct* terms that Whisper commonly
 * misrecognizes. Each list also includes proper nouns, eponyms, and
 * abbreviations specific to that organ system.
 */
const organVocabulary: Record<string, string[]> = {
  colon: [
    // Anatomy
    'cecal', 'cecum', 'ascending colon', 'transverse colon',
    'descending colon', 'sigmoid colon', 'rectum', 'appendix',
    'muscularis propria', 'submucosa', 'serosa', 'mesentery',
    // Diagnoses
    'adenocarcinoma', 'tubular adenoma', 'villous adenoma',
    'tubulovillous adenoma', 'hyperplastic polyp', 'sessile serrated lesion',
    'signet ring cell carcinoma', 'neuroendocrine tumor',
    'high-grade dysplasia', 'low-grade dysplasia',
    // Findings
    'surgical margins', 'perineural invasion', 'lymphovascular invasion',
    'muscularis propria invasion', 'serosal involvement',
    'tumor deposits', 'lymph nodes',
    // Grading
    'moderately differentiated', 'poorly differentiated', 'well differentiated',
    // Stains / ancillary
    'immunohistochemistry', 'IHC', 'hematoxylin and eosin', 'H&E',
    'mismatch repair', 'MLH1', 'MSH2', 'MSH6', 'PMS2',
    'microsatellite instability', 'MSI',
  ],

  breast: [
    // Anatomy
    'sentinel node', 'sentinel lymph node', 'axillary lymph node',
    'nipple', 'areola', 'pectoralis', 'fascia',
    // Diagnoses
    'invasive ductal carcinoma', 'ductal carcinoma in situ', 'DCIS',
    'invasive lobular carcinoma', 'lobular carcinoma in situ', 'LCIS',
    'fibroadenoma', 'phyllodes tumor', 'Paget disease',
    'mucinous carcinoma', 'tubular carcinoma', 'medullary carcinoma',
    // Biomarkers
    'HER2 positive', 'HER2 negative', 'HER2',
    'estrogen receptor', 'progesterone receptor', 'ER', 'PR',
    'triple negative', 'Ki-67',
    // Findings
    'microcalcifications', 'lymphovascular invasion',
    'perineural invasion', 'surgical margins',
    'Nottingham grade', 'Scarff-Bloom-Richardson',
    // Imaging
    'BI-RADS', 'mammography', 'ultrasound',
  ],

  prostate: [
    // Anatomy
    'prostate', 'seminal vesicle', 'prostatic urethra',
    'apex', 'base', 'mid gland', 'peripheral zone', 'transition zone',
    // Diagnoses / grading
    'acinar adenocarcinoma', 'Gleason score', 'Gleason pattern',
    'ISUP grade group', 'ISUP',
    'high-grade prostatic intraepithelial neoplasia', 'HGPIN',
    'atypical small acinar proliferation', 'ASAP',
    'intraductal carcinoma',
    // Findings
    'perineural invasion', 'extraprostatic extension',
    'seminal vesicle invasion', 'lymphovascular invasion',
    'surgical margins', 'positive margin',
    // Imaging
    'PI-RADS', 'MRI targeted biopsy', 'systematic biopsy',
    // Stains
    'p63', 'AMACR', 'racemase', 'high-molecular-weight cytokeratin',
    'PIN-4 cocktail',
  ],

  thyroid: [
    // Anatomy
    'thyroid', 'lobectomy', 'isthmus', 'pyramidal lobe',
    'parathyroid', 'recurrent laryngeal nerve',
    // Diagnoses
    'papillary carcinoma', 'papillary thyroid carcinoma', 'PTC',
    'follicular carcinoma', 'follicular adenoma',
    'Hurthle cell neoplasm', 'Hurthle cell carcinoma',
    'medullary carcinoma', 'anaplastic carcinoma',
    'noninvasive follicular thyroid neoplasm', 'NIFTP',
    'colloid nodule', 'multinodular goiter',
    // Classification
    'Bethesda', 'Bethesda category',
    'TI-RADS', 'fine needle aspiration', 'FNA',
    // Molecular
    'BRAF', 'RAS', 'RET/PTC', 'PAX8-PPARG',
    // Stains
    'thyroglobulin', 'TTF-1', 'calcitonin', 'chromogranin',
  ],

  lung: [
    // Anatomy
    'lung', 'bronchus', 'pleura', 'visceral pleura',
    'hilar', 'mediastinal', 'subcarinal',
    // Diagnoses
    'adenocarcinoma', 'squamous cell carcinoma',
    'non-small cell carcinoma', 'small cell carcinoma',
    'large cell neuroendocrine carcinoma',
    'carcinoid tumor', 'mesothelioma',
    'lepidic', 'acinar', 'papillary', 'micropapillary', 'solid',
    // Findings
    'pleural invasion', 'perineural invasion',
    'lymphovascular invasion', 'surgical margins',
    'bronchial margin', 'vascular margin',
    // Molecular
    'EGFR', 'ALK', 'ROS1', 'PD-L1', 'KRAS',
    // Stains
    'TTF-1', 'Napsin A', 'p40', 'CK5/6', 'synaptophysin',
  ],

  gi: [
    // Gastric / esophageal / small bowel
    'gastric', 'antrum', 'fundus', 'body', 'cardia',
    'esophagus', 'gastroesophageal junction', 'GEJ',
    'duodenum', 'jejunum', 'ileum',
    'Helicobacter pylori', 'H. pylori',
    'intestinal metaplasia', 'goblet cells',
    'signet ring cell', 'gastrointestinal stromal tumor', 'GIST',
    'Lauren classification', 'intestinal type', 'diffuse type',
    'Giemsa stain', 'Alcian blue',
  ],
};

/**
 * General pathology vocabulary applied to all organ systems.
 */
const generalVocabulary: string[] = [
  // Common terms
  'adenocarcinoma', 'carcinoma', 'neoplasm', 'dysplasia',
  'metastatic', 'metastasis', 'benign', 'malignant',
  'in situ', 'invasive', 'infiltrating',
  // Findings
  'perineural invasion', 'lymphovascular invasion',
  'surgical margins', 'uninvolved', 'involved',
  // Grading
  'well differentiated', 'moderately differentiated', 'poorly differentiated',
  // Staining
  'immunohistochemistry', 'IHC', 'hematoxylin and eosin', 'H&E',
  // Report structure
  'synoptic', 'CAP protocol', 'addendum', 'amendment',
];

/**
 * Build the vocabulary prompt string for a given specimen type.
 * Returns a comma-separated string of domain terms suitable for the
 * `prompt` parameter of the OpenAI transcription API.
 *
 * The result is deduplicated and trimmed to stay within the API's
 * 224-token prompt limit (~800 characters for English terms).
 */
export function buildTranscriptionPrompt(specimenType: string | null): string {
  const organKey = getOrganKey(specimenType);

  // Merge organ-specific + general vocabulary, deduplicate
  const organTerms = organKey ? (organVocabulary[organKey] ?? []) : [];
  const allTerms = [...new Set([...organTerms, ...generalVocabulary])];

  // Join and truncate to ~800 chars to stay within the 224-token prompt limit
  let prompt = allTerms.join(', ');
  if (prompt.length > 800) {
    // Prefer organ-specific terms (they appear first in the array)
    prompt = prompt.slice(0, 800);
    // Trim to last complete term (don't cut mid-word)
    const lastComma = prompt.lastIndexOf(',');
    if (lastComma > 0) {
      prompt = prompt.slice(0, lastComma);
    }
  }

  return prompt;
}

/**
 * Get the recommended transcription model identifier.
 * Returns the model string to use with the OpenAI transcription API.
 *
 * - 'gpt-4o-transcribe': Best accuracy, accent handling, prompt support (preferred)
 * - 'gpt-4o-mini-transcribe': Faster, lower cost, good for high-volume
 * - 'whisper-1': Legacy fallback (large-v2 based)
 */
export function getTranscriptionModel(preferSpeed: boolean = false): string {
  return preferSpeed ? 'gpt-4o-mini-transcribe' : 'gpt-4o-transcribe';
}

/**
 * Build the full transcription API request options.
 * Returns an object ready to pass to the OpenAI transcription endpoint.
 */
export function buildTranscriptionOptions(specimenType: string | null, options?: {
  language?: string;
  preferSpeed?: boolean;
}): {
  model: string;
  prompt: string;
  language: string;
  response_format: string;
} {
  return {
    model: getTranscriptionModel(options?.preferSpeed ?? false),
    prompt: buildTranscriptionPrompt(specimenType),
    language: options?.language ?? 'en',
    response_format: 'text',
  };
}

// Re-export getOrganKey for shared use with transcription-correction.ts
export { getOrganKey };

/**
 * Extract organ system keyword from specimen type string.
 * Returns lowercase key matching vocabulary map, or null.
 */
function getOrganKey(specimenType: string | null): string | null {
  if (!specimenType) return null;
  const lower = specimenType.toLowerCase();
  const keys = Object.keys(organVocabulary);
  for (const key of keys) {
    if (lower.includes(key)) return key;
  }
  // Check for GI-specific terms not covered by a direct keyword match
  if (/gastri|stomach|esophag|duoden|jejun|ileum/i.test(lower)) return 'gi';
  return null;
}
