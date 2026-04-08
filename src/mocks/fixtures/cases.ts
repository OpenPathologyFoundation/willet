// MSW Fixture Data — derived from Okapi/seed/wsi/wsi-test-cases.v1.json
// and Okapi/seed/patients/xenonym-azure-vale-9728.json

import type { ReportScaffold } from '$lib/types';

/**
 * S26-0004: Colon hemicolectomy — multi-block, single part, has a diagnosis
 * to start with. Good for testing autosave and clause editing.
 */
export const caseS26_0004: ReportScaffold = {
  case: {
    id: 'a0000004-0000-0000-0000-000000000004',
    caseId: 'S26-0004',
    collection: 'clinical',
    specimenType: 'Colon, right hemicolectomy',
    clinicalHistory:
      '46 y/o male with colon mass, biopsy positive for adenocarcinoma',
    accessionDate: '2026-01-16',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000018',
    displayName: 'Glilmezair Gusa',
    dob: '1980-01-22',
    sex: 'M',
  },
  parts: [
    {
      id: 'p0040001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Tumor',
      anatomicSite: 'Colon, right',
      finalDiagnosis:
        'Adenocarcinoma, moderately differentiated\nSurgical margins uninvolved (closest margin: 4 mm)\nLymph nodes: 2/14 positive for metastatic carcinoma\nLymphovascular invasion identified\nPerineural invasion not identified',
      metadata: {
        authored_label: 'Right colon, hemicolectomy',
        clause_types: [
          'DIAGNOSIS',
          'MARGIN',
          'ANCILLARY',
          'ANCILLARY',
          'ANCILLARY',
        ],
      },
      slides: [
        { slideId: 'S26-0004_A1_S1', stain: 'H&E', magnification: 40.0 },
        { slideId: 'S26-0004_A2_S1', stain: 'H&E', magnification: 40.0 },
        { slideId: 'S26-0004_A3_S1', stain: 'H&E', magnification: 20.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-001',
      displayName: 'Dr. Hlemsesor',
      role: 'PRIMARY',
    },
  ],
  reportState: 'DRAFT',
  transmission: null,
};

/**
 * S26-0005: Mastectomy with sentinel nodes — two parts (A: tumor, B: lymph node).
 * Good for testing multi-part navigation, keyboard Tab between parts.
 */
export const caseS26_0005: ReportScaffold = {
  case: {
    id: 'a0000005-0000-0000-0000-000000000005',
    caseId: 'S26-0005',
    collection: 'clinical',
    specimenType: 'Breast, right, mastectomy with sentinel nodes',
    clinicalHistory:
      '71 y/o female with right breast mass, 3.5 cm, BI-RADS 5',
    accessionDate: '2026-01-17',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000001',
    displayName: 'Ourfir Bruntilavoul',
    dob: '1955-02-15',
    sex: 'F',
  },
  parts: [
    {
      id: 'p0050001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Tumor',
      anatomicSite: 'Breast, right',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0005_A1_S1', stain: 'H&E', magnification: 40.0 },
        { slideId: 'S26-0005_A1_S2', stain: 'H&E', magnification: 40.0 },
      ],
    },
    {
      id: 'p0050002-0000-0000-0000-000000000002',
      partLabel: 'B',
      partDesignator: 'Sentinel lymph node',
      anatomicSite: 'Axilla, right',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0005_B1_S1', stain: 'H&E', magnification: 40.0 },
        { slideId: 'S26-0005_B1_S2', stain: 'H&E', magnification: 40.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-001',
      displayName: 'Dr. Hlemsesor',
      role: 'PRIMARY',
    },
    {
      identityId: 'id-resident-001',
      displayName: 'Dr. Gmuklus',
      role: 'RESIDENT',
    },
  ],
  reportState: 'DRAFT',
  transmission: null,
};

/**
 * S26-0002: Radical prostatectomy — two parts (A: right lobe, B: left lobe).
 * Part designators are terse OR labels ("Right lobe", "Left lobe"),
 * testing the authored_label refinement workflow.
 */
export const caseS26_0002: ReportScaffold = {
  case: {
    id: 'a0000002-0000-0000-0000-000000000002',
    caseId: 'S26-0002',
    collection: 'clinical',
    specimenType: 'Prostate, radical prostatectomy',
    clinicalHistory:
      '68 y/o male with rising PSA, Gleason 7 on biopsy',
    accessionDate: '2026-01-15',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000030',
    displayName: 'Ngupla Inotos',
    dob: '1958-01-20',
    sex: 'M',
  },
  parts: [
    {
      id: 'p0020001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Right lobe',
      anatomicSite: 'Prostate',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0002_A1_S1', stain: 'H&E', magnification: 40.0 },
      ],
    },
    {
      id: 'p0020002-0000-0000-0000-000000000002',
      partLabel: 'B',
      partDesignator: 'Left lobe',
      anatomicSite: 'Prostate',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0002_B1_S1', stain: 'H&E', magnification: 40.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-002',
      displayName: 'Dr. Bmodeswuv',
      role: 'PRIMARY',
    },
  ],
  reportState: 'DRAFT',
  transmission: null,
};

/**
 * S26-0001: Breast lumpectomy — single part, already has a finalized report.
 * Tests read-only finalized state and transmission status display.
 */
export const caseS26_0001_finalized: ReportScaffold = {
  case: {
    id: 'a0000001-0000-0000-0000-000000000001',
    caseId: 'S26-0001',
    collection: 'clinical',
    specimenType: 'Breast, left, lumpectomy',
    clinicalHistory:
      '58 y/o female with palpable left breast mass, 2.1 cm on imaging',
    accessionDate: '2026-01-15',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000024',
    displayName: 'Thisovau Oquuski',
    dob: '1967-08-24',
    sex: 'F',
  },
  parts: [
    {
      id: 'p0010001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Tumor with margins',
      anatomicSite: 'Breast, left',
      finalDiagnosis:
        'Invasive ductal carcinoma, grade 2\nSurgical margins uninvolved (closest margin: 2 mm)\nLymph nodes: not submitted',
      metadata: {
        authored_label: 'Breast, left, lumpectomy',
        clause_types: ['DIAGNOSIS', 'MARGIN', 'ANCILLARY'],
        finalization: {
          idempotency_key: 'f1000001-aaaa-bbbb-cccc-000000000001',
          finalized_by: 'id-attending-001',
          finalized_at: '2026-01-20T14:30:00Z',
          version_hash: 'sha256-placeholder-0001',
          previous_attempts: [],
        },
      },
      slides: [
        { slideId: 'S26-0001_A1_S1', stain: 'H&E', magnification: 40.0 },
        { slideId: 'S26-0001_A1_S2', stain: 'H&E', magnification: 40.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-001',
      displayName: 'Dr. Hlemsesor',
      role: 'PRIMARY',
    },
  ],
  reportState: 'FINALIZED',
  transmission: {
    id: 'tx-0001',
    idempotencyKey: 'f1000001-aaaa-bbbb-cccc-000000000001',
    finalizedBy: 'id-attending-001',
    finalizedAt: '2026-01-20T14:30:00Z',
    status: 'ACKED',
    hl7ErrorCode: null,
  },
};

/**
 * S26-0006: EGD gastric biopsies — two parts (antrum + body).
 * Sparse clinical history, tests the minimal-context scenario.
 */
export const caseS26_0006: ReportScaffold = {
  case: {
    id: 'a0000006-0000-0000-0000-000000000006',
    caseId: 'S26-0006',
    collection: 'clinical',
    specimenType: 'Stomach, biopsy',
    clinicalHistory:
      '62 y/o female with epigastric pain, H. pylori serology positive, EGD with antral erythema and erosions',
    accessionDate: '2026-01-23',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000042',
    displayName: 'Vrenala Polstice',
    dob: '1963-09-11',
    sex: 'F',
  },
  parts: [
    {
      id: 'p0060001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Gastric antrum',
      anatomicSite: 'Stomach, antrum',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0006_A1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0006_A1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0006_A1_S3', stain: 'Giemsa', magnification: 40.0 },
      ],
    },
    {
      id: 'p0060002-0000-0000-0000-000000000002',
      partLabel: 'B',
      partDesignator: 'Gastric body',
      anatomicSite: 'Stomach, body',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0006_B1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0006_B1_S2', stain: 'Giemsa', magnification: 40.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-001',
      displayName: 'Dr. Hlemsesor',
      role: 'PRIMARY',
    },
  ],
  reportState: 'DRAFT',
  transmission: null,
};

/**
 * S26-0007: Prostate needle biopsy — 12 systematic + 2 targeted cores.
 * Active surveillance patient. Tests long longitudinal prior history.
 */
export const caseS26_0007: ReportScaffold = {
  case: {
    id: 'a0000007-0000-0000-0000-000000000007',
    caseId: 'S26-0007',
    collection: 'clinical',
    specimenType: 'Prostate, needle biopsy',
    clinicalHistory:
      '72 y/o male on active surveillance for Gleason 3+3=6 prostate adenocarcinoma (diagnosed 2022). PSA rising from 5.8 to 8.2 over 18 months. MRI shows PI-RADS 4 lesion right mid-gland.',
    accessionDate: '2026-01-28',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000055',
    displayName: 'Torwesk Mulanden',
    dob: '1953-06-30',
    sex: 'M',
  },
  parts: [
    {
      id: 'p0070001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Right base',
      anatomicSite: 'Prostate, right base',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_A1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_A1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_A1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070002-0000-0000-0000-000000000002',
      partLabel: 'B',
      partDesignator: 'Right mid',
      anatomicSite: 'Prostate, right mid',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_B1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_B1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_B1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070003-0000-0000-0000-000000000003',
      partLabel: 'C',
      partDesignator: 'Right apex',
      anatomicSite: 'Prostate, right apex',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_C1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_C1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_C1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070004-0000-0000-0000-000000000004',
      partLabel: 'D',
      partDesignator: 'Left base',
      anatomicSite: 'Prostate, left base',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_D1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_D1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_D1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070005-0000-0000-0000-000000000005',
      partLabel: 'E',
      partDesignator: 'Left mid',
      anatomicSite: 'Prostate, left mid',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_E1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_E1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_E1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070006-0000-0000-0000-000000000006',
      partLabel: 'F',
      partDesignator: 'Left apex',
      anatomicSite: 'Prostate, left apex',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_F1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_F1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_F1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070007-0000-0000-0000-000000000007',
      partLabel: 'G',
      partDesignator: 'MRI target #1 (right mid, PI-RADS 4)',
      anatomicSite: 'Prostate, right mid',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_G1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_G1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_G1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
    {
      id: 'p0070008-0000-0000-0000-000000000008',
      partLabel: 'H',
      partDesignator: 'MRI target #2 (left apex, PI-RADS 3)',
      anatomicSite: 'Prostate, left apex',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0007_H1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_H1_S2', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0007_H1_S3', stain: 'H&E', magnification: 20.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-002',
      displayName: 'Dr. Bmodeswuv',
      role: 'PRIMARY',
    },
  ],
  reportState: 'DRAFT',
  transmission: null,
};

/**
 * S26-0008: Thyroid lobectomy — single part.
 * Critical prior FNA (Bethesda IV). Tests the "one prior result is essential" scenario.
 */
export const caseS26_0008: ReportScaffold = {
  case: {
    id: 'a0000008-0000-0000-0000-000000000008',
    caseId: 'S26-0008',
    collection: 'clinical',
    specimenType: 'Thyroid, right lobe, lobectomy',
    clinicalHistory:
      '54 y/o male with 2.8 cm right thyroid nodule, TI-RADS 4, FNA Bethesda IV (suspicious for follicular neoplasm)',
    accessionDate: '2026-02-04',
    status: 'pending_review',
    priority: 'routine',
  },
  patient: {
    mrn: 'XN-000061',
    displayName: 'Kehrad Svintola',
    dob: '1971-11-03',
    sex: 'M',
  },
  parts: [
    {
      id: 'p0080001-0000-0000-0000-000000000001',
      partLabel: 'A',
      partDesignator: 'Right thyroid lobe with isthmus',
      anatomicSite: 'Thyroid, right',
      finalDiagnosis: null,
      metadata: {},
      slides: [
        { slideId: 'S26-0008_A1_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0008_A2_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0008_A3_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0008_A4_S1', stain: 'H&E', magnification: 20.0 },
        { slideId: 'S26-0008_A5_S1', stain: 'H&E', magnification: 20.0 },
      ],
    },
  ],
  pathologists: [
    {
      identityId: 'id-attending-001',
      displayName: 'Dr. Hlemsesor',
      role: 'PRIMARY',
    },
    {
      identityId: 'id-fellow-001',
      displayName: 'Dr. Quilanthe',
      role: 'FELLOW',
    },
  ],
  reportState: 'DRAFT',
  transmission: null,
};

/** Index by caseId for mock handler lookup */
export const fixtureIndex: Record<string, ReportScaffold> = {
  'S26-0001': caseS26_0001_finalized,
  'S26-0002': caseS26_0002,
  'S26-0004': caseS26_0004,
  'S26-0005': caseS26_0005,
  'S26-0006': caseS26_0006,
  'S26-0007': caseS26_0007,
  'S26-0008': caseS26_0008,
};
